import boto3
from botocore.exceptions import NoCredentialsError

# Configuration
AWS_ACCESS_KEY = 'AKIA54WIGELOMENPXNKM'
AWS_SECRET_KEY = '7D3OzOm75ICytRUaXo1OahdsgM8/eyA+3uFe5GCx'
BUCKET_NAME = 'weighbridge-csv-storage'  # Your actual bucket name
FILE_PATH = r'C:\CUBEAI TECH\weigh-bridge\tickets_data.csv'
OBJECT_NAME = 'tickets_data.csv'  # S3 object name

def upload_to_s3():
    try:
        s3 = boto3.client('s3',
                          aws_access_key_id=AWS_ACCESS_KEY,
                          aws_secret_access_key=AWS_SECRET_KEY)

        s3.upload_file(FILE_PATH, BUCKET_NAME, OBJECT_NAME)
        print(f"✅ Uploaded to s3://{BUCKET_NAME}/{OBJECT_NAME}")

    except FileNotFoundError:
        print("❌ File not found.")
    except NoCredentialsError:
        print("❌ AWS credentials not available.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    upload_to_s3()
