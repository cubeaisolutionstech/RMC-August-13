from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
from pdf2image import convert_from_path
from PIL import Image
import pymysql
from pymysql.err import MySQLError
import pytesseract
import google.generativeai as genai
from db_config import get_db_connection
import mysql.connector
from datetime import datetime, date
import json
import logging
import sys
import re
import pandas as pd
import shutil
import uuid
import dateutil.parser
from mysql.connector import Error

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
    genai.configure(api_key="AIzaSyDJxoGa82XWvNwPBBMwhfJNajhKIjXmd2c")
    logger.debug("Gemini API configured successfully")
    model = genai.GenerativeModel('gemma-3n-e4b-it')
except Exception as e:
    logger.error(f"Failed to configure Gemini API: {e}", exc_info=True)
    raise

# Configure Tesseract
try:
    tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    if not os.path.exists(tesseract_path):
        raise FileNotFoundError(f"Tesseract executable not found at {tesseract_path}")
    pytesseract.pytesseract.tesseract_cmd = tesseract_path
    pytesseract_version = pytesseract.get_tesseract_version()
    logger.debug(f"Tesseract configured, version: {pytesseract_version}")
except Exception as e:
    logger.error(f"Failed to configure Tesseract: {e}", exc_info=True)
    raise

# Define folders and filenames
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
OUTPUT_DIR = "converted"
os.makedirs(OUTPUT_DIR, exist_ok=True)
CSV_PATHS = {
    "SupplierDetail": os.path.join(OUTPUT_DIR, "SupplierDetail.csv"),
    "PURCHASE ORDER": os.path.join(OUTPUT_DIR, "po.csv"),
    "INDENT": os.path.join(OUTPUT_DIR, "indent.csv")
}

# --- Utility Functions ---
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
    if isinstance(data, dict):
        return {k: convert_to_json_serializable(v) for k, v in data.items()}
    elif isinstance(data, date):
        return data.isoformat()
    return data

def clean_value(value):
    if value == "NULL" or value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        try:
            return float(value)
        except ValueError:
            return value
    return value

def parse_quantity(quantity_str):
    if not quantity_str or quantity_str == "NULL":
        return 0.0
    try:
        match = re.match(r"(\d+\.\d+|\d+)", quantity_str)
        if match:
            return float(match.group(0))
        return float(quantity_str.split()[0])
    except (ValueError, IndexError):
        return 0.0

def parse_rate(rate_str):
    if not rate_str or rate_str == "NULL":
        return 0.0
    try:
        return float(rate_str.split('/')[0])
    except (ValueError, IndexError):
        return 0.0

def parse_date(date_str):
    if not date_str or date_str == "NULL":
        return None
    try:
        parsed = dateutil.parser.parse(date_str, dayfirst=False)
        return parsed.strftime('%Y-%m-%d')
    except (ValueError, TypeError):
        return None

# --- Invoice Extraction Service Routes ---
@app.post("/extract-invoice/")
async def extract_invoice(file: UploadFile = File(...), supplier_id: str = Form(None)):
    tmp_path = None
    conn = None
    cursor = None
    try:
        logger.debug(f"Starting processing for file: {file.filename}, content_type: {file.content_type}, supplier_id: {supplier_id}")

        # Validate supplier_id if provided
        if supplier_id and not re.match(r'^[A-Za-z0-9_-]+$', supplier_id):
            return JSONResponse(
                status_code=400,
                content={"status": "error", "error": "Invalid supplier_id format"}
            )

        # Validate file size
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

        # Save file to uploads folder
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4().hex}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        with open(file_path, "wb") as f:
            f.write(content)
        logger.debug(f"File saved to: {file_path}")

        # Create temporary file for OCR
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
                tmp_file.write(content)
                tmp_path = tmp_file.name
            logger.debug(f"Temporary file created: {tmp_path}")
        except Exception as e:
            logger.error(f"Failed to create temporary file: {e}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"status": "error", "error": f"Failed to create temporary file: {str(e)}"}
            )

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
        - For numeric fields, remove currency symbols and units, returning plain numbers.
        - Use supplier_id parameter if provided, otherwise extract supplier from document.
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
            invoice_data['supplier_id'] = supplier_id
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

        # Convert numeric fields (corrected version to handle empty strings)
        numeric_fields = ['qty', 'rate', 'amount', 'empty_weight', 'load_weight', 'net_weight', 'tax', 'cgst', 'sgst', 'round_off', 'total']
        for key in numeric_fields:
            value = invoice_data.get(key, None)
            if value is not None and str(value).strip() != "":
                try:
                    invoice_data[key] = float(re.sub(r'[^\d.-]', '', str(value)))
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to convert {key} to float: {e}, value: {value}")
                    invoice_data[key] = None
            else:
                invoice_data[key] = None  # Handle empty or invalid value

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
            cursor.execute("SELECT DATABASE()")
            current_db = cursor.fetchone()[0]
            logger.debug(f"Connected to database: {current_db}")

            # Ensure table exists
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS invoice_items (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    supplier_id VARCHAR(255),
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
                    file_name VARCHAR(255),
                    file_content LONGBLOB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            """)
            logger.debug("Table invoice_items ensured to exist")

            cursor.execute("DESCRIBE invoice_items")
            schema = cursor.fetchall()
            logger.debug(f"Current invoice_items schema: {schema}")

            # Add missing columns if necessary
            for column, column_type in [
                ("supplier_id", "VARCHAR(255)"),
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
                ("amount_in_words", "TEXT"),
                ("file_name", "VARCHAR(255)"),
                ("file_content", "LONGBLOB")
            ]:
                try:
                    cursor.execute(f"ALTER TABLE invoice_items ADD COLUMN {column} {column_type}")
                    logger.debug(f"Added {column} column to invoice_items")
                except mysql.connector.Error as e:
                    if e.errno != 1060:  # Ignore "Duplicate column name"
                        logger.error(f"Failed to add {column} column: {e}")
                        raise

            insert_data = (
                invoice_data.get("supplier_id", supplier_id),
                invoice_data.get("vehicle_number", ""),
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
                invoice_data.get("amount_in_words", ""),
                file.filename,
                content  # Store file content as BLOB
            )

            logger.debug(f"Inserting data into invoice_items: {insert_data[:-1]}")  # Exclude file_content for logging
            cursor.execute("""
                INSERT INTO invoice_items (
                    supplier_id, vehicle_number, description, quantity, rate, amount, supplier_name,
                    invoice_number, invoice_date, gstin, address, empty_weight, load_weight,
                    net_weight, tax, cgst, sgst, round_off, total, amount_in_words, file_name, file_content
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, insert_data)
            invoice_id = cursor.lastrowid
            conn.commit()
            logger.debug(f"Data inserted into invoice_items successfully, invoice_id: {invoice_id}")

            return {
                "status": "success",
                "data": invoice_data,
                "file_path": unique_filename,  # Return file path for frontend
                "invoice_id": invoice_id,
                "message": "Invoice data extracted and stored successfully"
            }
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
        if conn and conn.is_connected():
            conn.close()
            logger.debug("Database connection closed")
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                logger.debug(f"Temporary file deleted: {tmp_path}")
            except Exception as e:
                logger.error(f"Failed to delete temporary file {tmp_path}: {e}")



                

@app.get("/get-invoice-file/{invoice_id}")
async def get_invoice_file(invoice_id: int):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        logger.debug(f"Fetching file for invoice_id: {invoice_id}")
        cursor.execute("SELECT file_name, file_content FROM invoice_items WHERE id = %s", (invoice_id,))
        result = cursor.fetchone()
        if not result or not result["file_content"]:
            raise HTTPException(status_code=404, detail="File not found for the given invoice_id")
        
        # Write file to temporary location for serving
        file_extension = os.path.splitext(result["file_name"])[1]
        temp_file_path = f"temp_{uuid.uuid4().hex}{file_extension}"
        with open(temp_file_path, "wb") as f:
            f.write(result["file_content"])
        
        return FileResponse(
            path=temp_file_path,
            filename=result["file_name"],
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={result['file_name']}"}
        )
    except mysql.connector.Error as db_error:
        logger.error(f"Database query failed: {db_error}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(db_error)}")
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()
        if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.debug(f"Temporary file deleted: {temp_file_path}")
            except Exception as e:
                logger.error(f"Failed to delete temporary file {temp_file_path}: {e}")

@app.get("/uploads/{filename}")
async def serve_uploaded_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream"
    )

@app.get("/invoices")
async def get_invoices():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        logger.debug(f"Database connection established for fetching invoices at {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}")
        cursor.execute("SELECT id, supplier_id, vehicle_number, description, quantity, rate, amount, supplier_name, invoice_number, invoice_date, gstin, address, empty_weight, load_weight, net_weight, tax, cgst, sgst, round_off, total, amount_in_words, file_name FROM invoice_items")
        invoices = cursor.fetchall()
        logger.debug(f"Fetched {len(invoices)} invoices from invoice_items at {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}")
        invoices = [convert_to_json_serializable({**invoice, "file_path": f"{invoice['file_name']}" if invoice['file_name'] else None}) for invoice in invoices]
        return {
            "status": "success",
            "data": invoices,
            "message": "Invoices fetched successfully"
        }
    except mysql.connector.Error as db_error:
        logger.error(f"Database query failed: {db_error}")
        return JSONResponse(
            status_code=500,
            content={"status": "db_error", "error": str(db_error)}
        )
    finally:
        if cursor:
            cursor.close()
            logger.debug(f"Database cursor closed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}")
        if conn:
            conn.close()
            logger.debug(f"Database connection closed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Combined Invoice and Voucher Service"}

# --- Voucher Processing Service Routes ---
@app.get("/")
def home():
    return {
        "message": "Upload JSON. Vouchers will be saved in po_details table (for PURCHASE ORDER) and CSVs (SupplierDetail.csv, po.csv, indent.csv) based on type."
    }

@app.get("/api/vouchers/materials-by-voucher")
async def get_materials_by_voucher(vch_no: str = Query(...)):
    logger.info(f"Received request to /api/vouchers/materials-by-voucher?vch_no={vch_no}")
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            logger.error("Database connection failed")
            raise HTTPException(status_code=500, detail="Database connection failed")
        cursor = conn.cursor(dictionary=True, buffered=True)
        query = """
            SELECT v.vch_no, ie.stock_item
            FROM vouchers v
            LEFT JOIN inventory_entries ie ON v.id = ie.voucher_id
            WHERE v.vch_no = %s
            ORDER BY v.vch_no, ie.stock_item
        """
        params = [vch_no]
        cursor.execute(query, params)
        rows = cursor.fetchall()

        if not rows:
            return {"status": "success", "data": {}, "total_vouchers": 0}

        result = {vch_no: []}
        for row in rows:
            stock_item = row["stock_item"]
            if stock_item and stock_item not in result[vch_no]:
                result[vch_no].append(stock_item)
            elif not stock_item and None not in result[vch_no]:
                result[vch_no].append(None)

        result[vch_no] = list(dict.fromkeys(result[vch_no]))
        return {
            "status": "success",
            "data": result,
            "total_vouchers": 1 if result[vch_no] else 0
        }
    except HTTPException as e:
        raise e
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

@app.get("/api/vouchers/customer-name")
async def get_customer_name_by_vch_no(vch_no: str = Query(...)):
    logger.info(f"Received request to /api/vouchers/customer-name?vch_no={vch_no}")
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        cursor = conn.cursor(dictionary=True, buffered=True)
        query = "SELECT customer_name FROM vouchers WHERE vch_no = %s"
        cursor.execute(query, (vch_no,))
        row = cursor.fetchone()
        cursor.fetchall()

        if not row or not row["customer_name"]:
            raise HTTPException(status_code=404, detail=f"No customer name found for vch_no: {vch_no}")

        return {
            "status": "success",
            "vch_no": vch_no,
            "customer_name": row["customer_name"]
        }
    except HTTPException as e:
        raise e
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

@app.get("/api/vouchers/inventory-details")
async def get_inventory_details_by_vch_no(vch_no: str = Query(...)):
    logger.info(f"Received request to /api/vouchers/inventory-details?vch_no={vch_no}")
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        cursor = conn.cursor(dictionary=True, buffered=True)
        query = """
            SELECT ie.stock_item, ie.actual_qty, ie.rate
            FROM inventory_entries ie
            JOIN vouchers v ON ie.voucher_id = v.id
            WHERE v.vch_no = %s
            LIMIT 1
        """
        cursor.execute(query, (vch_no,))
        row = cursor.fetchone()
        cursor.fetchall()

        if not row:
            raise HTTPException(status_code=404, detail=f"No inventory details found for vch_no: {vch_no}")

        material_mapping = {
            "Steel Reinforcement Rod 8mm Dia": "Steel",
            "TMT Bars 12mm": "TMT Bars",
        }
        stock_item = material_mapping.get(row["stock_item"], row["stock_item"] or "")

        return {
            "status": "success",
            "vch_no": vch_no,
            "stock_item": stock_item,
            "actual_qty": float(row["actual_qty"]) if row["actual_qty"] is not None else 0.0,
            "rate": float(row["rate"]) if row["rate"] is not None else 0.0
        }
    except HTTPException as e:
        raise e
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

@app.get("/api/po-details")
async def get_po_details():
    logger.info("Received request to /api/po-details")
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        cursor = conn.cursor(dictionary=True, buffered=True)
        query = """
            SELECT id, poNumber, material, supplier, quantity, rate, totalAmount, poType, deliveryDate, narration, status, createdAt, updatedAt
            FROM po_details
        """
        cursor.execute(query)
        rows = cursor.fetchall()

        if not rows:
            return {"status": "success", "headers": [], "data": [], "total_rows": 0}

        headers = [
            "id", "poNumber", "material", "supplier", "quantity", "rate", "totalAmount",
            "poType", "deliveryDate", "narration", "status", "createdAt", "updatedAt"
        ]
        data = [list(row.values()) for row in rows]

        return {
            "status": "success",
            "headers": headers,
            "data": data,
            "total_rows": len(data)
        }
    except Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

@app.get("/get-csv-data/{csv_type}")
async def get_csv_data(csv_type: str):
    logger.info(f"Received request to /get-csv-data/{csv_type}")
    try:
        csv_file_map = {
            "po": CSV_PATHS["PURCHASE ORDER"],
            "SupplierDetail": CSV_PATHS["SupplierDetail"],
            "indent": CSV_PATHS["INDENT"]
        }
        if csv_type not in csv_file_map:
            raise HTTPException(status_code=400, detail="Invalid CSV type")
        csv_path = csv_file_map[csv_type]
        if not os.path.exists(csv_path):
            return {"status": "success", "headers": [], "data": [], "total_rows": 0}
        df = pd.read_csv(csv_path)
        if df.empty:
            return {"status": "success", "headers": [], "data": [], "total_rows": 0}
        df = df.replace({float('inf'): None, float('-inf'): None}).fillna("")
        headers = df.columns.tolist()
        data = df.values.tolist()
        return {
            "status": "success",
            "headers": headers,
            "data": data,
            "total_rows": len(data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading CSV: {str(e)}")

@app.get("/download/{csv_type}")
async def download_csv(csv_type: str):
    logger.info(f"Received request to /download/{csv_type}")
    try:
        csv_file_map = {
            "po": CSV_PATHS["PURCHASE ORDER"],
            "SupplierDetail": CSV_PATHS["SupplierDetail"],
            "indent": CSV_PATHS["INDENT"]
        }
        if csv_type not in csv_file_map:
            raise HTTPException(status_code=400, detail="Invalid CSV type")
        csv_path = csv_file_map[csv_type]
        if not os.path.exists(csv_path):
            raise HTTPException(status_code=404, detail="CSV file not found")
        return FileResponse(
            path=csv_path,
            filename=f"{csv_type}_data.csv",
            media_type="application/octet-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading CSV: {str(e)}")

@app.delete("/clear-csv/{csv_type}")
async def clear_csv(csv_type: str):
    logger.info(f"Received request to /clear-csv/{csv_type}")
    try:
        csv_file_map = {
            "po": CSV_PATHS["PURCHASE ORDER"],
            "SupplierDetail": CSV_PATHS["SupplierDetail"],
            "indent": CSV_PATHS["INDENT"]
        }
        if csv_type not in csv_file_map:
            raise HTTPException(status_code=400, detail="Invalid CSV type")
        csv_path = csv_file_map[csv_type]
        if os.path.exists(csv_path):
            os.remove(csv_path)
        return {"status": "success", "message": f"{csv_type.upper()} CSV cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing CSV: {str(e)}")

@app.post("/upload-json/")
async def upload_json(file: UploadFile = File(...)):
    logger.info("Received request to /upload-json/")
    conn = None
    cursor = None
    temp_file_path = None
    try:
        temp_file_path = f"temp_{uuid.uuid4().hex}.json"
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        with open(temp_file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if "Voucher" not in data:
            raise HTTPException(status_code=400, detail="'Voucher' key missing in JSON")

        grouped_data = {
            "SupplierDetail": [],
            "PURCHASE ORDER": [],
            "INDENT": []
        }

        conn = get_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        cursor = conn.cursor(buffered=True)

        insert_voucher_query = '''
            INSERT INTO vouchers (
                sal_time, voucher_type_name, vch_no, date, effective_date, narration, state_buyer, cancel, refund,
                customer_name, mailing_name, customer_web_id, customer_tally_id, billing_address, consignee_name,
                shipping_address, billing_pin_code, shipping_pin_code, billing_phone_no, shipping_phone_no,
                total_amount, sales_tally_id, web_id, action, billing_state, billing_country, shipping_state,
                shipping_country, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''

        insert_inventory_query = '''
            INSERT INTO inventory_entries (
                voucher_id, stock_item, debitor_credit, billed_qty, actual_qty, rate, discount, amount
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        '''

        insert_batch_query = '''
            INSERT INTO batch_allocations (
                inventory_id, batch_name, godown_name, batch_billed_qty, batch_actual_qty, batch_rate, batch_discount, amount
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        '''

        insert_accounting_query = '''
            INSERT INTO accounting_allocations (
                inventory_id, ledger_name, amount
            ) VALUES (%s, %s, %s)
        '''

        insert_ledger_query = '''
            INSERT INTO ledger_details (
                voucher_id, ledger_name, debitor_credit, amount
            ) VALUES (%s, %s, %s, %s)
        '''

        insert_bill_wise_query = '''
            INSERT INTO bill_wise_details (
                ledger_id, bill_type, bill_amount
            ) VALUES (%s, %s, %s)
        '''

        insert_po_query = '''
            INSERT INTO po_details (
                poNumber, material, supplier, quantity, rate, totalAmount, poType, deliveryDate, narration, status, createdAt, updatedAt
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''

        purchase_order_count = 0
        errors = []

        for voucher in data.get("Voucher", []):
            vtype = clean_value(voucher.get("VoucherTypeName", "")).upper()
            if "SUPPLIERDETAIL" in vtype:
                key = "SupplierDetail"
            elif "PURCHASE ORDER" in vtype or "PO" in vtype:
                key = "PURCHASE ORDER"
            elif "INDENT" in vtype:
                key = "INDENT"
            else:
                errors.append(f"Unknown VoucherTypeName: {vtype} for VchNo: {voucher.get('VchNo', 'Unknown')}")
                continue

            base_info = {k: clean_value(v) for k, v in voucher.items() if k not in ["Inventory Entries", "Ledgerdetails"]}
            try:
                sal_time = base_info.get('SalTime')
                voucher_type_name = base_info.get('VoucherTypeName', '')
                vch_no = base_info.get('VchNo', '')
                date = parse_date(base_info.get('Date'))
                effective_date = parse_date(base_info.get('EffectiveDate'))
                narration = base_info.get('Narration', '')
                state_buyer = base_info.get('StateBuyer')
                cancel = base_info.get('Cancel')
                refund = base_info.get('Refund', '')
                customer_name = base_info.get('CustomerName', '')
                mailing_name = base_info.get('MailingName', '')
                customer_web_id = base_info.get('CustomerWebID')
                customer_tally_id = base_info.get('CustomerTallyID')
                billing_address = base_info.get('BillingAddress', '')
                consignee_name = base_info.get('ConsigneeName', '')
                shipping_address = base_info.get('ShippingAddress', '')
                billing_pin_code = base_info.get('BillingPinCode', '')
                shipping_pin_code = base_info.get('ShippingPinCode', '')
                billing_phone_no = base_info.get('BillingPhoneNo')
                shipping_phone_no = base_info.get('ShippingPhoneNo')
                total_amount = float(base_info.get('TotalAmount', 0.0))
                sales_tally_id = base_info.get('SalesTallyID', '')
                web_id = base_info.get('WebID')
                action = base_info.get('Action')
                billing_state = base_info.get('BillingState', '')
                billing_country = base_info.get('BillingCountry', '')
                shipping_state = base_info.get('ShippingState', '')
                shipping_country = base_info.get('ShippingCountry', '')
                created_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                updated_at = created_at

                cursor.execute(insert_voucher_query, (
                    sal_time, voucher_type_name, vch_no, date, effective_date, narration, state_buyer, cancel, refund,
                    customer_name, mailing_name, customer_web_id, customer_tally_id, billing_address, consignee_name,
                    shipping_address, billing_pin_code, shipping_pin_code, billing_phone_no, shipping_phone_no,
                    total_amount, sales_tally_id, web_id, action, billing_state, billing_country, shipping_state,
                    shipping_country, created_at, updated_at
                ))
                voucher_id = cursor.lastrowid
            except Exception as e:
                errors.append(f"Error inserting voucher (VchNo: {voucher.get('VchNo', 'Unknown')}): {str(e)}")
                continue

            if "Inventory Entries" in voucher and voucher["Inventory Entries"]:
                for inventory in voucher.get("Inventory Entries", []):
                    inv_info = {k: clean_value(v) for k, v in inventory.items() if k not in ["BatchAllocations", "AccountingAllocations"]}
                    try:
                        stock_item = inv_info.get('StockItem', '')
                        debitor_credit = inv_info.get('DebitorCredit', '')
                        billed_qty = parse_quantity(inv_info.get('BilledQty'))
                        actual_qty = parse_quantity(inv_info.get('AcutalQty'))
                        rate = parse_rate(inv_info.get('Rate'))
                        discount = float(inv_info.get('Discount', 0))
                        amount = float(inv_info.get('Amount', 0.0))

                        cursor.execute(insert_inventory_query, (
                            voucher_id, stock_item, debitor_credit, billed_qty, actual_qty, rate, discount, amount
                        ))
                        inventory_id = cursor.lastrowid
                    except Exception as e:
                        errors.append(f"Error inserting inventory entry for VchNo: {vch_no}: {str(e)}")
                        continue

                    if "BatchAllocations" in inventory and inventory["BatchAllocations"]:
                        for batch in inventory.get("BatchAllocations", []):
                            batch_info = {k: clean_value(v) for k, v in batch.items()}
                            combined_row = {**base_info, **inv_info, **batch_info}
                            grouped_data[key].append(combined_row)
                            try:
                                batch_name = batch_info.get('BatchName', '')
                                godown_name = batch_info.get('GodownName', '')
                                batch_billed_qty = parse_quantity(batch_info.get('BatchBilledQty'))
                                batch_actual_qty = parse_quantity(batch_info.get('BatchActualQty'))
                                batch_rate = parse_rate(batch_info.get('BatchRate'))
                                batch_discount = float(batch_info.get('BatchDiscount', 0))
                                batch_amount = float(batch_info.get('Amount', 0.0))

                                cursor.execute(insert_batch_query, (
                                    inventory_id, batch_name, godown_name, batch_billed_qty, batch_actual_qty,
                                    batch_rate, batch_discount, batch_amount
                                ))
                            except Exception as e:
                                errors.append(f"Error inserting batch allocation for VchNo: {vch_no}: {str(e)}")
                                continue

                            if key == "PURCHASE ORDER":
                                try:
                                    poNumber = vch_no
                                    material = stock_item
                                    supplier = customer_name
                                    quantity = billed_qty
                                    rate_val = rate
                                    totalAmount = amount
                                    poType = voucher_type_name
                                    deliveryDate = date
                                    narration_val = narration
                                    status = 'Active'
                                    createdAt = created_at
                                    updatedAt = created_at

                                    if not poNumber or not deliveryDate:
                                        raise ValueError(f"Missing required fields: poNumber={poNumber}, deliveryDate={deliveryDate}")

                                    cursor.execute(insert_po_query, (
                                        poNumber, material, supplier, quantity, rate_val, totalAmount,
                                        poType, deliveryDate, narration_val, status, createdAt, updatedAt
                                    ))
                                    purchase_order_count += 1
                                except Exception as e:
                                    errors.append(f"Error inserting purchase order (VchNo: {vch_no}, StockItem: {stock_item}): {str(e)}")
                                    continue
                    else:
                        combined_row = {**base_info, **inv_info}
                        grouped_data[key].append(combined_row)
                        if "AccountingAllocations" in inventory and inventory["AccountingAllocations"]:
                            for accounting in inventory.get("AccountingAllocations", []):
                                try:
                                    ledger_name = clean_value(accounting.get('LedgerName', ''))
                                    acc_amount = float(clean_value(accounting.get('Amount', 0.0)))
                                    cursor.execute(insert_accounting_query, (
                                        inventory_id, ledger_name, acc_amount
                                    ))
                                except Exception as e:
                                    errors.append(f"Error inserting accounting allocation for VchNo: {vch_no}: {str(e)}")
                                    continue

                        if key == "PURCHASE ORDER":
                            try:
                                poNumber = vch_no
                                material = stock_item
                                supplier = customer_name
                                quantity = billed_qty
                                rate_val = rate
                                totalAmount = amount
                                poType = voucher_type_name
                                deliveryDate = date
                                narration_val = narration
                                status = 'Active'
                                createdAt = created_at
                                updatedAt = created_at

                                if not poNumber or not deliveryDate:
                                    raise ValueError(f"Missing required fields: poNumber={poNumber}, deliveryDate={deliveryDate}")

                                cursor.execute(insert_po_query, (
                                    poNumber, material, supplier, quantity, rate_val, totalAmount,
                                    poType, deliveryDate, narration_val, status, createdAt, updatedAt
                                ))
                                purchase_order_count += 1
                            except Exception as e:
                                errors.append(f"Error inserting purchase order (VchNo: {vch_no}, StockItem: {stock_item}): {str(e)}")
                                continue
            else:
                combined_row = base_info
                grouped_data[key].append(combined_row)
                if key == "PURCHASE ORDER":
                    try:
                        poNumber = vch_no
                        material = ''
                        supplier = customer_name
                        quantity = 0.0
                        rate_val = 0.0
                        totalAmount = total_amount
                        poType = voucher_type_name
                        deliveryDate = date
                        narration_val = narration
                        status = 'Active'
                        createdAt = created_at
                        updatedAt = created_at

                        if not poNumber or not deliveryDate:
                            raise ValueError(f"Missing required fields: poNumber={poNumber}, deliveryDate={deliveryDate}")

                        cursor.execute(insert_po_query, (
                            poNumber, material, supplier, quantity, rate_val, totalAmount,
                            poType, deliveryDate, narration_val, status, createdAt, updatedAt
                        ))
                        purchase_order_count += 1
                    except Exception as e:
                        errors.append(f"Error inserting purchase order (VchNo: {vch_no}): {str(e)}")
                        continue

            if "Ledgerdetails" in voucher and voucher["Ledgerdetails"]:
                for ledger in voucher.get("Ledgerdetails", []):
                    try:
                        ledger_name = clean_value(ledger.get('Ledgername', ''))
                        debitor_credit = clean_value(ledger.get('DebitorCredit', ''))
                        amount = float(clean_value(ledger.get('Amount', 0.0)))
                        cursor.execute(insert_ledger_query, (
                            voucher_id, ledger_name, debitor_credit, amount
                        ))
                        ledger_id = cursor.lastrowid
                    except Exception as e:
                        errors.append(f"Error inserting ledger detail for VchNo: {vch_no}: {str(e)}")
                        continue

                    if "BillWiseDetails" in ledger and ledger["BillWiseDetails"]:
                        for bill in ledger.get("BillWiseDetails", []):
                            try:
                                bill_type = clean_value(bill.get('BillType', ''))
                                bill_amount = float(clean_value(bill.get('Amount', 0.0)))
                                cursor.execute(insert_bill_wise_query, (
                                    ledger_id, bill_type, bill_amount
                                ))
                            except Exception as e:
                                errors.append(f"Error inserting bill wise detail for VchNo: {vch_no}: {str(e)}")
                                continue

        conn.commit()

        if purchase_order_count > 0:
            try:
                cursor.execute(
                    '''
                    INSERT INTO system_logs (branch_name, module_name, action_performed, action_by, action_on, ip_address, timestamp)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ''',
                    (
                        'Main Branch', 'Purchase Orders', 'Insert', 'System',
                        f'Uploaded {purchase_order_count} records to po_details', '127.0.0.1', datetime.now()
                    )
                )
                conn.commit()
            except Exception as e:
                errors.append(f"Error inserting system log: {str(e)}")

        result = []
        for vtype_key, records in grouped_data.items():
            if not records:
                continue
            try:
                df_new = pd.DataFrame(records)
                csv_path = CSV_PATHS[vtype_key]
                df_new = df_new.astype(str).replace('nan', '')
                if os.path.exists(csv_path):
                    df_existing = pd.read_csv(csv_path).astype(str).replace('nan', '')
                    all_columns = list(set(df_existing.columns.tolist() + df_new.columns.tolist()))
                    df_existing = df_existing.reindex(columns=all_columns, fill_value="")
                    df_new = df_new.reindex(columns=all_columns, fill_value="")
                    combined_df = pd.concat([df_existing, df_new], ignore_index=True)
                else:
                    combined_df = df_new
                combined_df.to_csv(csv_path, index=False)
                result.append({
                    "voucher_type": vtype_key,
                    "file": csv_path,
                    "rows_added": len(df_new),
                    "total_rows": combined_df.shape[0]
                })
            except Exception as e:
                errors.append(f"Error saving CSV for {vtype_key}: {str(e)}")

        response = {
            "status": "success",
            "message": f"File processed: {purchase_order_count} records saved to po_details table, all details saved to respective tables, data also saved to CSVs.",
            "details": result
        }
        if errors:
            response["errors"] = errors
        if not result and purchase_order_count == 0:
            raise HTTPException(
                status_code=400,
                detail="No valid VoucherType found (SupplierDetail, Purchase Order, Indent) and no purchase orders saved."
            )
        return response
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()
@app.get("/grn/")
async def get_grn_data(vch_no: str = Query(...)):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        cursor = conn.cursor(dictionary=True)

        # Fetch voucher details
        voucher_query = """
            SELECT id, sal_time, voucher_type_name, vch_no, date, effective_date, narration, state_buyer, 
                cancel, refund, customer_name, mailing_name, customer_web_id, customer_tally_id, 
                billing_address, consignee_name, shipping_address, billing_pin_code, shipping_pin_code, 
                billing_phone_no, shipping_phone_no, total_amount, sales_tally_id, web_id, action, 
                billing_state, billing_country, shipping_state, shipping_country
            FROM vouchers 
            WHERE vch_no = %s
        """
        cursor.execute(voucher_query, (vch_no,))
        voucher = cursor.fetchone()
        if not voucher:
            raise HTTPException(status_code=404, detail=f"No voucher found for vch_no: {vch_no}")

        voucher_id = voucher['id']

        # Inventory entries
        inventory_query = """
            SELECT id, stock_item, debitor_credit, billed_qty, actual_qty, rate, discount, amount
            FROM inventory_entries
            WHERE voucher_id = %s
        """
        cursor.execute(inventory_query, (voucher_id,))
        inventory_entries = cursor.fetchall()

        inventory_data = []
        for entry in inventory_entries:
            entry_id = entry['id']

            # Fetch supplier data for BatchAllocations
            supplier_query = """
                SELECT receivedQty, poRate, supplierBillRate
                FROM supplier
                WHERE poNumber = %s
            """
            cursor.execute(supplier_query, (vch_no,))
            supplier_rows = cursor.fetchall()
            batches = [{
                "batch_name": "Primary Batch",
                "godown_name": "Thulasi Readymix",
                "batch_billed_qty": f"{float(s['receivedQty']):.2f} cft" if s['receivedQty'] is not None else None,
                "batch_actual_qty": f"{float(s['receivedQty']):.2f} cft" if s['receivedQty'] is not None else None,
                "batch_rate": f"{float(s['poRate']):.2f}/cft" if s['poRate'] is not None else None,
                "batch_discount": 0,
                "amount": float(s['supplierBillRate']) if s['supplierBillRate'] is not None else None
            } for s in supplier_rows]

            # Accounting allocations
            accounting_query = """
                SELECT ledger_name, amount
                FROM accounting_allocations
                WHERE inventory_id = %s
            """
            cursor.execute(accounting_query, (entry_id,))
            accounting_rows = cursor.fetchall()
            accountings = [{
                "ledger_name": a['ledger_name'],
                "amount": float(a['amount']) if a['amount'] is not None else None
            } for a in accounting_rows]

            inventory_data.append({
                "StockItem": entry['stock_item'],
                "DebitorCredit": entry['debitor_credit'],
                "BilledQty": f"{float(entry['billed_qty']):.2f} cft" if entry['billed_qty'] is not None else None,
                "AcutalQty": f"{float(entry['actual_qty']):.2f} cft" if entry['actual_qty'] is not None else None,
                "Rate": f"{float(entry['rate']):.2f}/cft" if entry['rate'] is not None else None,
                "Discount": float(entry['discount']) if entry['discount'] is not None else None,
                "Amount": float(entry['amount']) if entry['amount'] is not None else None,
                "BatchAllocations": batches,
                "AccountingAllocations": accountings
            })

        # Ledger details
        ledger_query = """
            SELECT id, ledger_name, debitor_credit, amount
            FROM ledger_details
            WHERE voucher_id = %s
        """
        cursor.execute(ledger_query, (voucher_id,))
        ledger_rows = cursor.fetchall()

        ledger_details = []
        for ledger in ledger_rows:
            ledger_id = ledger['id']

            bill_wise_query = """
                SELECT bill_type, bill_amount
                FROM bill_wise_details
                WHERE ledger_id = %s
            """
            cursor.execute(bill_wise_query, (ledger_id,))
            bill_rows = cursor.fetchall()
            bill_wise_list = [{
                "bill_type": bw['bill_type'],
                "bill_amount": float(bw['bill_amount']) if bw['bill_amount'] is not None else None
            } for bw in bill_rows]

            ledger_details.append({
                "Ledgername": ledger['ledger_name'],
                "DebitorCredit": ledger['debitor_credit'],
                "Amount": float(ledger['amount']) if ledger['amount'] is not None else None,
                "BillWiseDetails": bill_wise_list
            })

        # Prepare final response
        response = {
            "Voucher": [{
                "SalTime": voucher['sal_time'],
                "VoucherTypeName": voucher['voucher_type_name'],
                "VchNo": voucher['vch_no'],
                "Date": str(voucher['date']) if voucher['date'] else None,
                "EffectiveDate": str(voucher['effective_date']) if voucher['effective_date'] else None,
                "Narration": voucher['narration'],
                "StateBuyer": voucher['state_buyer'],
                "Cancel": voucher['cancel'],
                "Refund": voucher['refund'],
                "CustomerName": voucher['customer_name'],
                "MailingName": voucher['mailing_name'],
                "CustomerWebID": voucher['customer_web_id'],
                "CustomerTallyID": voucher['customer_tally_id'],
                "BillingAddress": voucher['billing_address'],
                "ConsigneeName": voucher['consignee_name'],
                "ShippingAddress": voucher['shipping_address'],
                "BillingPinCode": voucher['billing_pin_code'],
                "ShippingPinCode": voucher['shipping_pin_code'],
                "BillingPhoneNo": voucher['billing_phone_no'],
                "ShippingPhoneNo": voucher['shipping_phone_no'],
                "TotalAmount": float(voucher['total_amount']) if voucher['total_amount'] is not None else None,
                "SalesTallyID": voucher['sales_tally_id'],
                "WebID": voucher['web_id'],
                "Action": voucher['action'],
                "BillingState": voucher['billing_state'],
                "BillingCountry": voucher['billing_country'],
                "ShippingState": voucher['shipping_state'],
                "ShippingCountry": voucher['shipping_country'],
                "Inventory Entries": inventory_data,
                "Ledgerdetails": ledger_details
            }]
        }

        return JSONResponse(content={"status": "success", "data": response})

    except HTTPException as e:
        raise e
    except MySQLError as e:
        logger.error(f"MySQL error: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Unexpected error occurred")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
@app.post("/extract-vehicle/")
async def extract_vehicle(file: UploadFile = File(...)):
    tmp_path = None
    conn = None
    cursor = None
    try:
        logger.debug(f"Starting vehicle number extraction for file: {file.filename}, content_type: {file.content_type}")

        # Validate file size
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

        # Save file to uploads folder
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4().hex}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        with open(file_path, "wb") as f:
            f.write(content)
        logger.debug(f"File saved to: {file_path}")

        # Create temporary file for OCR
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
                tmp_file.write(content)
                tmp_path = tmp_file.name
            logger.debug(f"Temporary file created: {tmp_path}")
        except Exception as e:
            logger.error(f"Failed to create temporary file: {e}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"status": "error", "error": f"Failed to create temporary file: {str(e)}"}
            )

        # Extract text
        text = extract_text(tmp_path, file.content_type)
        if not text:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "error": "No text extracted from file", "raw_text": text[:200] if text else None}
            )

        # Extract vehicle number using regex
        vehicle_pattern = r'[A-Z]{2}\d{2}[A-Z]{2}\d{4}'
        vehicle_match = re.search(vehicle_pattern, text)
        if not vehicle_match:
            logger.error("Vehicle number not found in file")
            return JSONResponse(
                status_code=400,
                content={"status": "error", "error": "Vehicle number not found in file", "raw_text": text[:200]}
            )

        vehicle_no = vehicle_match.group(0)
        logger.debug(f"Extracted vehicleNo: {vehicle_no}")

        # Validate vehicle number format
        if not re.match(r'^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$', vehicle_no):
            logger.error(f"Invalid vehicle number format: {vehicle_no}")
            return JSONResponse(
                status_code=400,
                content={"status": "error", "error": f"Invalid vehicle number format: {vehicle_no}"}
            )

        # Database operations
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            logger.debug("Database connection established")

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS invoice_items (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    supplier_id VARCHAR(255),
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
                    file_name VARCHAR(255),
                    file_content LONGBLOB,
                    status VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            """)
            logger.debug("Table invoice_items ensured to exist")

            insert_data = (
                None,  # supplier_id
                vehicle_no,
                None,  # description
                None,  # quantity
                None,  # rate
                None,  # amount
                None,  # supplier_name
                None,  # invoice_number
                None,  # invoice_date
                None,  # gstin
                None,  # address
                None,  # empty_weight
                None,  # load_weight
                None,  # net_weight
                None,  # tax
                None,  # cgst
                None,  # sgst
                None,  # round_off
                None,  # total
                None,  # amount_in_words
                file.filename,
                content,  # file_content
                'Pending'
            )

            logger.debug(f"Inserting data into invoice_items: {insert_data[:-1]}")  # Exclude file_content for logging
            cursor.execute("""
                INSERT INTO invoice_items (
                    supplier_id, vehicle_number, description, quantity, rate, amount, supplier_name,
                    invoice_number, invoice_date, gstin, address, empty_weight, load_weight,
                    net_weight, tax, cgst, sgst, round_off, total, amount_in_words, file_name, file_content, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, insert_data)
            invoice_id = cursor.lastrowid
            conn.commit()
            logger.debug(f"Data inserted into invoice_items successfully, invoice_id: {invoice_id}")

            return {
                "status": "success",
                "vehicleNo": vehicle_no,
                "invoice_id": invoice_id,
                "file_path": unique_filename,
                "message": "Vehicle number extracted and stored successfully"
            }
        except mysql.connector.Error as db_error:
            logger.error(f"Database insertion failed: {db_error}, SQL State: {db_error.sqlstate}, Error Code: {db_error.errno}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"status": "db_error", "error": str(db_error)}
            )
    finally:
        if cursor:
            cursor.close()
            logger.debug("Database cursor closed")
        if conn and conn.is_connected():
            conn.close()
            logger.debug("Database connection closed")
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                logger.debug(f"Temporary file deleted: {tmp_path}")
            except Exception as e:
                logger.error(f"Failed to delete temporary file {tmp_path}: {e}")
          

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
