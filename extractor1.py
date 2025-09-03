from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
from pdf2image import convert_from_path
from PIL import Image
import pytesseract
import google.generativeai as genai
from db_config import get_db_connection
import mysql.connector
from datetime import datetime, date
import json
import logging
import sys
import re

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
try:
    genai.configure(api_key="AIzaSyCKiy1Of1RnuF1Hc20MkGtgXXrc5seeS8Q")
    logger.debug("Gemini API configured successfully")
    # Initialize the Gemini model
    model = genai.GenerativeModel('gemini-1.5-pro')  # Updated to a valid model
except Exception as e:
    logger.error(f"Failed to configure Gemini API: {e}", exc_info=True)
    raise

# Configure Tesseract
try:
    tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'  # Windows Tesseract path
    if not os.path.exists(tesseract_path):
        raise FileNotFoundError(f"Tesseract executable not found at {tesseract_path}")
    pytesseract.pytesseract.tesseract_cmd = tesseract_path
    pytesseract_version = pytesseract.get_tesseract_version()
    logger.debug(f"Tesseract configured, version: {pytesseract_version}")
except Exception as e:
    logger.error(f"Failed to configure Tesseract: {e}", exc_info=True)
    raise

def extract_text(path, content_type):
    try:
        logger.debug(f"Extracting text from {path}, content_type: {content_type}")
        if content_type not in ["application/pdf", "image/png", "image/jpeg", "image/jpg"]:
            logger.error(f"Unsupported content type: {content_type}")
            return None
        if content_type == "application/pdf":
            images = convert_from_path(path)
            text = "\n".join([pytesseract.image_to_string(img) for img in images])
        else:
            image = Image.open(path)
            text = pytesseract.image_to_string(image)
        logger.debug(f"Extracted text (first 100 chars): {text[:100]}...")
        return text
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}", exc_info=True)
        return None

def convert_to_json_serializable(data):
    """Convert datetime.date objects to ISO strings for JSON serialization."""
    if isinstance(data, dict):
        return {k: convert_to_json_serializable(v) for k, v in data.items()}
    elif isinstance(data, date):
        return data.isoformat()
    return data

@app.post("/extract-invoice/")
async def extract_invoice(file: UploadFile = File(...), vehicle_number: str = Form(None)):
    tmp_path = None
    conn = None
    cursor = None
    try:
        logger.debug(f"Starting processing for file: {file.filename}, content_type: {file.content_type}")
        
        # Validate file size (e.g., max 10MB)
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "error": "File size exceeds 10MB limit"}
            )

        # Validate content type
        if file.content_type not in ["application/pdf", "image/png", "image/jpeg", "image/jpg"]:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "error": f"Unsupported file type: {file.content_type}"}
            )

        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
            tmp_file.write(content)
            tmp_path = tmp_file.name
        logger.debug(f"Temporary file created: {tmp_path}")

        # Extract text
        text = extract_text(tmp_path, file.content_type)
        if not text:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "error": "No text extracted from file", "raw_text": text[:200] if text else None}
            )

        # Prepare and send prompt to Gemini
        prompt = f"""
        Extract all invoice bill details into a JSON object with these keys:
        supplier, address, gstin, invoice_no, invoice_date, vehicle_number, token_no, description, qty, rate, amount, empty_weight, load_weight, net_weight, tax, cgst, sgst, round_off, total, amount_in_words

        Rules:
        - Extract all information from the invoice text.
        - For numeric fields (qty, rate, amount, empty_weight, load_weight, net_weight, tax, cgst, sgst, round_off, total), remove currency symbols and units, returning plain numbers.
        - Use vehicle_number parameter if provided, otherwise extract from document.
        - Leave fields as null or empty strings if not found.
        - Format invoice_date as YYYY-MM-DD if extractable.
        - Ensure the output is valid JSON, enclosed in ```json and ``` markers.

        Invoice text:
        {text}
        """

        logger.debug("Sending prompt to Gemini model")
        try:
            response = model.generate_content(prompt, generation_config={"temperature": 0.1, "max_output_tokens": 2000})
            logger.debug(f"Full Gemini response: {response.text}")
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"status": "error", "error": f"Gemini API error: {str(e)}"}
            )

        # Parse JSON response
        json_text = response.text.strip()
        if json_text.startswith('```json'):
            json_text = json_text[7:]
        if json_text.endswith('```'):
            json_text = json_text[:-3]
        try:
            invoice_data = json.loads(json_text) if json_text else {}
            invoice_data = convert_to_json_serializable(invoice_data)
            logger.debug(f"Parsed invoice data: {invoice_data}")
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}, Raw response: {json_text}", exc_info=True)
            return JSONResponse(
                status_code=400,
                content={"status": "error", "error": f"Failed to parse JSON: {e}", "raw_response": json_text}
            )

        if not invoice_data:
            logger.warning("No valid data extracted from Gemini response")
            return JSONResponse(
                status_code=400,
                content={"status": "error", "error": "No valid data extracted", "raw_response": json_text}
            )

        # Convert numeric fields
        numeric_fields = ['qty', 'rate', 'amount', 'empty_weight', 'load_weight', 'net_weight', 'tax', 'cgst', 'sgst', 'round_off', 'total']
        for key in numeric_fields:
            if key in invoice_data and invoice_data[key]:
                try:
                    invoice_data[key] = float(re.sub(r'[^\d.-]', '', str(invoice_data[key])))
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to convert {key} to float: {e}, value: {invoice_data[key]}")
                    invoice_data[key] = None

        # Parse invoice_date
        if invoice_data.get("invoice_date"):
            try:
                invoice_date = datetime.strptime(invoice_data["invoice_date"], "%Y-%m-%d").date()
                invoice_data["invoice_date"] = invoice_date.isoformat()
            except ValueError as e:
                logger.warning(f"Invalid invoice_date format: {e}, value: {invoice_data['invoice_date']}")
                invoice_data["invoice_date"] = None

        # Database operations
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            logger.debug("Database connection established")
            
            # Log current database
            cursor.execute("SELECT DATABASE()")
            current_db = cursor.fetchone()[0]
            logger.debug(f"Connected to database: {current_db}")
            
            # Ensure table exists
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS invoice_items (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    vehicle_number VARCHAR(255),
                    description TEXT,
                    quantity DECIMAL(10,2),
                    rate DECIMAL(10,2),
                    amount DECIMAL(10,2),
                    supplier_name VARCHAR(255),
                    invoice_number VARCHAR(100),
                    invoice_date DATE,
                    gstin VARCHAR(15),
                    address TEXT,
                    empty_weight DECIMAL(10,2),
                    load_weight DECIMAL(10,2),
                    net_weight DECIMAL(10,2),
                    tax DECIMAL(10,2),
                    cgst DECIMAL(10,2),
                    sgst DECIMAL(10,2),
                    round_off DECIMAL(10,2),
                    total DECIMAL(10,2),
                    amount_in_words TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            """)
            logger.debug("Table invoice_items ensured to exist")

            # Log current table schema
            cursor.execute("DESCRIBE invoice_items")
            schema = cursor.fetchall()
            logger.debug(f"Current invoice_items schema: {schema}")

            # Add missing columns
            for column, column_type in [
                ("description", "TEXT"),
                ("gstin", "VARCHAR(15)"),
                ("address", "TEXT"),
                ("empty_weight", "DECIMAL(10,2)"),
                ("load_weight", "DECIMAL(10,2)"),
                ("net_weight", "DECIMAL(10,2)"),
                ("tax", "DECIMAL(10,2)"),
                ("cgst", "DECIMAL(10,2)"),
                ("sgst", "DECIMAL(10,2)"),
                ("round_off", "DECIMAL(10,2)"),
                ("total", "DECIMAL(10,2)"),
                ("amount_in_words", "TEXT")
            ]:
                try:
                    cursor.execute(f"ALTER TABLE invoice_items ADD COLUMN {column} {column_type}")
                    logger.debug(f"Added {column} column to invoice_items")
                except mysql.connector.Error as e:
                    if e.errno != 1060:  # Ignore "Duplicate column name"
                        logger.error(f"Failed to add {column} column: {e}")
                        raise

            # Prepare data for insertion
            insert_data = (
                invoice_data.get("vehicle_number", vehicle_number),
                invoice_data.get("description", ""),
                invoice_data.get("qty"),
                invoice_data.get("rate"),
                invoice_data.get("amount"),
                invoice_data.get("supplier", ""),
                invoice_data.get("invoice_no", ""),
                invoice_data.get("invoice_date"),
                invoice_data.get("gstin", ""),
                invoice_data.get("address", ""),
                invoice_data.get("empty_weight"),
                invoice_data.get("load_weight"),
                invoice_data.get("net_weight"),
                invoice_data.get("tax"),
                invoice_data.get("cgst"),
                invoice_data.get("sgst"),
                invoice_data.get("round_off"),
                invoice_data.get("total"),
                invoice_data.get("amount_in_words", "")
            )

            cursor.execute("""
                INSERT INTO invoice_items (
                    vehicle_number, description, quantity, rate, amount, supplier_name,
                    invoice_number, invoice_date, gstin, address, empty_weight, load_weight,
                    net_weight, tax, cgst, sgst, round_off, total, amount_in_words
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, insert_data)
            conn.commit()
            logger.debug("Data inserted into invoice_items successfully")
        except mysql.connector.Error as db_error:
            logger.error(f"Database insertion failed: {db_error}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"status": "db_error", "error": str(db_error), "invoice_data": invoice_data}
            )
        finally:
            if cursor:
                cursor.close()
                logger.debug("Database cursor closed")
            if conn:
                conn.close()
                logger.debug("Database connection closed")
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                    logger.debug(f"Temporary file deleted: {tmp_path}")
                except Exception as e:
                    logger.error(f"Failed to delete temporary file {tmp_path}: {e}")

        return {
            "status": "success",
            "data": invoice_data,
            "message": "Invoice data extracted and stored successfully"
        }

    except Exception as e:
        logger.error(f"Unexpected error in endpoint: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"status": "error", "error": str(e), "file_path": tmp_path if tmp_path else None}
        )

@app.get("/invoices")
async def get_invoices():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        logger.debug("Database connection established for fetching invoices")

        cursor.execute("SELECT * FROM invoice_items")
        invoices = cursor.fetchall()
        logger.debug(f"Fetched {len(invoices)} invoices from invoice_items")

        # Convert dates to ISO strings
        invoices = [convert_to_json_serializable(invoice) for invoice in invoices]

        return {
            "status": "success",
            "data": invoices,
            "message": "Invoices fetched successfully"
        }
    except mysql.connector.Error as db_error:
        logger.error(f"Database query failed: {db_error}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"status": "db_error", "error": str(db_error)}
        )
    finally:
        if cursor:
            cursor.close()
            logger.debug("Database cursor closed")
        if conn:
            conn.close()
            logger.debug("Database connection closed")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Invoice Extractor"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)