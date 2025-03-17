# Get the database using the method we defined in pymongo_test_insert file
from pymongo_get_database import get_database
import json

dbname = get_database()
collection_name = dbname["issei_data"]

with open("output.json", "r") as file:
    data = json.load(file)

# Insert data into MongoDB
collection_name.insert_many(data)

print('done')


"""
Add it to github
run issei, sansei
negro
"""