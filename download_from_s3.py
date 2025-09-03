import boto3

AWS_ACCESS_KEY = 'AKIA54WIGELOMENPXNKM'
AWS_SECRET_KEY = '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'
BUCKET_NAME = 'weighbridge-csv-storage' 
OBJECT_NAME = 'tickets_data.csv'
DOWNLOAD_PATH = r'E:\construction-app\src\backend\downloaded_tickets_data.csv'

def download_from_s3():
    try:
        s3 = boto3.client('s3',
                          aws_access_key_id=AWS_ACCESS_KEY,
                          aws_secret_access_key=AWS_SECRET_KEY)

        s3.download_file(BUCKET_NAME, OBJECT_NAME, DOWNLOAD_PATH)
        print(f"✅ Downloaded to: {DOWNLOAD_PATH}")

    except Exception as e:
        print(f"❌ Download failed: {e}")

if __name__ == "__main__":
    download_from_s3()
