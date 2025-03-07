from pymongo import MongoClient
def get_database():
 
   # Provide the mongodb atlas url to connect python to mongodb using pymongo
   CONNECTION_STRING = "mongodb+srv://americanprintculture:UuwlNFcIn0dVLuny@cluster0.qxdxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
 
   # Create a connection using MongoClient
   client = MongoClient(CONNECTION_STRING)
 
   # Create the database
   return client['webscraper_data']
  
# This is added so that many files can reuse the function get_database()
if __name__ == "__main__":   
  
   # Get the database
   dbname = get_database()