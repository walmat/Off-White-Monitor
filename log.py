def log(tag, text):
	# Info tag
	if(tag == 'i'):
		print("[INFO] " + text)
	# Warning tag
	elif(tag == 'w'):
		print('[WARN] ' + text)
	# Error tag
	elif(tag == 'e'):
		print("[ERROR] " + text)
	# Success tag
	elif(tag == 's'):
		print("[SUCCESS] " + text)