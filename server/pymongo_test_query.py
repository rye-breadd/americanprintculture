import pandas as pd 
from pymongo_get_database import get_database

# Retreives the database
dbname = get_database()
 
# Retreives the collection temp in database
collection_name = dbname["temp"]

# Goes into the collection and collects all the items in there
item_details = collection_name.find()

# Conversion to pandas for ease of observation
items_df = pd.DataFrame(item_details)
print(items_df)
