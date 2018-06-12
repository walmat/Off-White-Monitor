import requests
import json
from bs4 import BeautifulSoup as soup
from log import log as log
import time
from datetime import datetime
import random
import sqlite3
from discord_hooks import Webhook
import slackweb
from threading import Thread
import urllib.request

user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3107.4 Safari/537.36'
headers = {}
headers['User-Agent'] = user_agent
headers['Content-Type'] = 'application/json'

class Product():
    def __init__(self, title, link, stock, keyword, image_url, stock_options):

        self.title = title
        self.stock = stock
        self.link = link
        self.keyword = keyword
        self.image_url = image_url
        self.stock_options = stock_options

def read_from_txt(path):

    # Initialize variables
    raw_lines = []
    lines = []

    # Load data from the txt file
    try:
        f = open(path, "r")
        raw_lines = f.readlines()
        f.close()

    # Raise an error if the file couldn't be found
    except:
        log('e', "Couldn't locate: " + path)
        raise FileNotFound()

    if(len(raw_lines) == 0):
        log('w', "No data found in: " + path)
        raise NoDataLoaded()

    # Parse the data
    for line in raw_lines:
        lines.append(line.strip("\n"))

    # Return the data
    return lines


def add_to_db(product):

    # Initialize variables
    title = product.title
    stock = str(product.stock)
    link = product.link
    keyword = product.keyword
    alert = False

    # log('i', stock)

    # Create database
    conn = sqlite3.connect('products.db')
    c = conn.cursor()

    c.execute("""CREATE TABLE IF NOT EXISTS products(title TEXT, link TEXT UNIQUE, stock TEXT, keywords TEXT)""")

    # Add product to database if it's unique
    try:
        c.execute("""INSERT INTO products (title, link, stock, keywords) VALUES (?, ?, ?, ?)""", (title, link, stock, keyword))
        log('s', "Found new product with keyword " + keyword + ". Link = " + link)        
        alert = True
    except:
        # Product already exists, let's check for stock updates
        try:
            d = (link,)
            c.execute('SELECT (stock) FROM products WHERE link=?', d)
            old_stock = c.fetchone()
            stock_str = str(old_stock)[2:-3]
            if str(stock_str).strip() == str(product.stock).strip():
                log('w', "Product at URL: " + link + " already exists in the database.")
                pass
            else:
                # TODO - update table for that product
                log('s', "Product at URL: " + link + " changed stock.")
                c.execute("""UPDATE products SET stock = ? WHERE link= ?""", (stock_str, link))
                alert = True
        except sqlite3.Error as e:
            log('e', "database error: " + str(e))
            log('w', "Product data for: " + link + " failed to load..")

    # Close connection to the database
    conn.commit()
    c.close()
    conn.close()

    # Return whether or not it's a new product
    return alert

def notify(product, slack, discord):

    times = []
    today = datetime.now()
    times.append(today)
    sizes = ""

    for size in product.stock_options:
        sizes+= (size + " ")

    if slack:
        sc = slackweb.Slack(url=slack)
        attachments = []
        attachment = {
            "title": product.title,
            "color":"#EAF4EC", 
            "text": product.link,
            "fields": [
                {
                    "title": "Sizes",
                    "value": sizes,
                    "short": False
                }
            ],
            "mrkdwn_in": ["text"],
            "thumb_url": product.image_url,
            "footer": "BBGR",
            "footer_icon": "https://platform.slack-edge.com/img/default_application_icon.png",
            "ts": time.time()
        }
        attachments.append(attachment)
        sc.notify(attachments=attachments)

    if discord:
        embed = Webhook(discord, color=0xEAF4EC)
        embed.set_title(title=product.title, url=product.link)
        embed.set_thumbnail(url=product.image_url)
        embed.add_field(name="Sizes", value=sizes)
        embed.set_footer(text='BBGR', icon='https://cdn.discordapp.com/embed/avatars/0.png', ts=True)
        embed.post()

def monitor(link, keywords, slack, discord):

    log('i', "Checking site: " + link + "...")
    isSearch = False
    links = []
    pages = []
    # Parse the site from the link
    pos_https = link.find("https://")
    pos_http = link.find("http://")

    if(pos_https == 0):
        site = link[8:]
        end = site.find("/")
        if(end != -1):
            site = site[:end]
        site = "https://" + site
    else:
        site = link[7:]
        end = site.find("/")
        if(end != -1):
            site = site[:end]
        site = "http://" + site

    # build search links
    if (link.endswith('=')):
        isSearch = True
        for word in keywords:
            links.append(link + word)

    if isSearch:
        for l in links:
            try:
                r = requests.get(l, timeout=5, verify=False)
                pages.append(r)
            except:
                log('e', 'Connection to URL: ' + l + " failed. Retrying...")
                time.sleep(5)
                try:
                    r.requests.get(l, timeout=8, verify=False)
                except:      
                    log('e', 'Connection to URL: ' + l + " failed.")
                    return

    else:
        # Get all the products on that page
        try:
            r = requests.get(link, timeout=5, verify=False)
            pages.append(r)
        except:
            log('e', "Connection to URL: " + link + " failed. Retrying...")
            time.sleep(5)
            try:
                r = requests.get(link, timeout=8, verify=False)
                pages.append(r)
            except:
                log('e', "Connection to URL: " + link + " failed.")
                return

    for p in pages:

        page = soup(p.text, "html.parser")
        raw_links = page.findAll("article", class_="product")
        captions = page.findAll("div", class_='brand-name')
        images = page.findAll('img', class_='top')
        hrefs = []

        for raw_link in raw_links:
            link = raw_link.find('a', attrs={"itemprop": "url"})
            try:
                hrefs.append(link["href"])
            except:
                pass

        index = 0
        for href in hrefs:
            found = False
            if len(keywords) > 0:
                for keyword in keywords:
                    if keyword.upper() in captions[index].text.upper():
                        found = True
                        stock_data = []
                        
                        url = (site+hrefs[index]+'.json')

                        req = urllib.request.Request(url, headers=headers)
                        resp = urllib.request.urlopen(req).read()

                        size_opts = json.loads(resp.decode('utf-8'))['available_sizes']
                        # parse through the list
                        if not size_opts:
                            stock_data.append('Unavailable')
                        else:
                            for size in size_opts:
                                stock_data.append(size['name'])

                        product = Product(captions[index].text, (site + hrefs[index]), stock_data, keyword, str(images[index]['src']), stock_data)
                        alert = add_to_db(product)

                        if alert:
                            notify(product, slack, discord)
            index = index + 1

def __main__():
    # Ignore insecure messages (for now)
    requests.packages.urllib3.disable_warnings()

    with open('config.json') as config:
        j = json.load(config)

    ######### CHANGE THESE #########
    #  KEYWORDS: (seperated by -)  #
    keywords = [                   #
       "converse",
       "UNC",
       "Jordan",
       "Mercurial",
       "Zoom-Fly",
       "Nike"                   
    ]                             
    slack = j['slack']
    discord = j['discord']

    # Load sites from file
    sites = read_from_txt("ow-pages.txt")

    # Start monitoring sites
    while(True):
        threads = []
        for site in sites:
            # skip over blank lines and shit
            if not site.strip():
                pass
            else :
                t = Thread(target=monitor, args=(site, keywords, slack, discord))
                threads.append(t)
                t.start()
                time.sleep(2)



            