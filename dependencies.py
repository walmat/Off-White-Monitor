#!/usr/bin/python
import pip
import sys
from log import log as log
import ow

pip.main(['install','requests'])
pip.main(['install','json'])
pip.main(['install','bs4'])
pip.main(['install','time'])
pip.main(['install','datetime'])
pip.main(['install','time'])
pip.main(['install','sqlite3'])
pip.main(['install','slackweb'])
pip.main(['install','threading'])
pip.main(['install', 'sultan'])
pip.main(['install', 'keyboard'])

log('i', "dependencies installed/updated. starting the script")

ow.__main__()