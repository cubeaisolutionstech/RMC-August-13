import mysql.connector

def get_db_connection():
    conn = mysql.connector.connect(
        host="localhost",
        user="root",  
        password="tja15122003",  
        database="construction"
    )
    return conn
