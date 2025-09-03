
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import json
import shutil
import uuid
import os
from db_config import get_db_connection
from mysql.connector import Error
from datetime import datetime
import dateutil.parser
import re
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Explicitly allow React app origin
    allow_credentials=True,  # Support credentials
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Define folders and filenames
OUTPUT_DIR = "converted"
os.makedirs(OUTPUT_DIR, exist_ok=True)

CSV_PATHS = {
    "SupplierDetail": os.path.join(OUTPUT_DIR, "SupplierDetail.csv"),
    "PURCHASE ORDER": os.path.join(OUTPUT_DIR, "po.csv"),
    "INDENT": os.path.join(OUTPUT_DIR, "indent.csv")
}

@app.get("/")
def home():
    return {
        "message": "Upload JSON. Vouchers will be saved in po_details table (for PURCHASE ORDER) and CSVs (SupplierDetail.csv, po.csv, indent.csv) based on type."
    }
@app.get("/api/vouchers/materials-by-voucher")
async def get_materials_by_voucher(vch_no: str = Query(...)):
    """Retrieve stock items for a specific voucher number."""
    print(f"Received request to /api/vouchers/materials-by-voucher?vch_no={vch_no}")
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            print("Database connection failed")
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
        print(f"Executing query: {query} with params: {params}")
        cursor.execute(query, params)
        rows = cursor.fetchall()

        if not rows:
            print(f"No voucher or material data found for vch_no: {vch_no}")
            return {"status": "success", "data": {}, "total_vouchers": 0}

        # Group stock_items for the specified vch_no
        result = {}
        vch_no_key = vch_no
        result[vch_no_key] = []
        for row in rows:
            stock_item = row["stock_item"]
            if stock_item and stock_item not in result[vch_no_key]:  # Avoid duplicates
                result[vch_no_key].append(stock_item)
            elif not stock_item and None not in result[vch_no_key]:  # Include NULL once
                result[vch_no_key].append(None)

        # Remove duplicates within the vch_no
        result[vch_no_key] = list(dict.fromkeys(result[vch_no_key]))

        print(f"Retrieved materials for voucher {vch_no}")
        return {
            "status": "success",
            "data": result,
            "total_vouchers": 1 if result[vch_no_key] else 0
        }
    except HTTPException as e:
        print(f"HTTP exception: {str(e)}")
        raise e
    except Error as e:
        print(f"Database error fetching materials for vch_no {vch_no}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        print(f"Unexpected error fetching materials for vch_no {vch_no}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()
        print("Database connection closed")
@app.get("/api/vouchers/customer-name")
async def get_customer_name_by_vch_no(vch_no: str = Query(...)):
    """Retrieve customer name from the vouchers table based on vch_no (query parameter)."""
    logger.info(f"Received request to /api/vouchers/customer-name?vch_no={vch_no}")
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            logger.error("Database connection failed")
            raise HTTPException(status_code=500, detail="Database connection failed")
        cursor = conn.cursor(dictionary=True, buffered=True)  # Use buffered cursor
        query = "SELECT customer_name FROM vouchers WHERE vch_no = %s"
        logger.debug(f"Executing query: {query} with vch_no={vch_no}")
        cursor.execute(query, (vch_no,))
        row = cursor.fetchone()

        # Consume any remaining results to prevent 'Unread result found'
        cursor.fetchall()

        if not row or not row["customer_name"]:
            logger.warning(f"No customer name found for vch_no: {vch_no}")
            raise HTTPException(status_code=404, detail=f"No customer name found for vch_no: {vch_no}")

        logger.info(f"Retrieved customer_name: {row['customer_name']} for vch_no: {vch_no}")
        return {
            "status": "success",
            "vch_no": vch_no,
            "customer_name": row["customer_name"]
        }
    except HTTPException as e:
        logger.error(f"HTTP exception for vch_no {vch_no}: {str(e)}")
        raise e
    except Error as e:
        logger.error(f"Database error fetching customer name for vch_no {vch_no}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error fetching customer name for vch_no {vch_no}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()
        logger.info("Database connection closed")

@app.get("/api/vouchers/inventory-details")
async def get_inventory_details_by_vch_no(vch_no: str = Query(...)):
    """Retrieve stock_item, actual_qty, and rate from inventory_entries based on vch_no."""
    logger.info(f"Received request to /api/vouchers/inventory-details?vch_no={vch_no}")
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            logger.error("Database connection failed")
            raise HTTPException(status_code=500, detail="Database connection failed")
        cursor = conn.cursor(dictionary=True, buffered=True)  # Use buffered cursor
        query = """
            SELECT ie.stock_item, ie.actual_qty, ie.rate
            FROM inventory_entries ie
            JOIN vouchers v ON ie.voucher_id = v.id
            WHERE v.vch_no = %s
            LIMIT 1
        """
        logger.debug(f"Executing query: {query} with vch_no={vch_no}")
        cursor.execute(query, (vch_no,))
        row = cursor.fetchone()

        # Consume any remaining results
        cursor.fetchall()

        if not row:
            logger.warning(f"No inventory details found for vch_no: {vch_no}")
            raise HTTPException(status_code=404, detail=f"No inventory details found for vch_no: {vch_no}")

        # Material mapping for frontend compatibility
        material_mapping = {
            "Steel Reinforcement Rod 8mm Dia": "Steel",
            "TMT Bars 12mm": "TMT Bars",
            # Add other mappings as needed
        }
        stock_item = material_mapping.get(row["stock_item"], row["stock_item"] or "")

        logger.info(f"Retrieved inventory details: stock_item={stock_item}, actual_qty={row['actual_qty']}, rate={row['rate']} for vch_no={vch_no}")
        return {
            "status": "success",
            "vch_no": vch_no,
            "stock_item": stock_item,
            "actual_qty": float(row["actual_qty"]) if row["actual_qty"] is not None else 0.0,
            "rate": float(row["rate"]) if row["rate"] is not None else 0.0
        }
    except HTTPException as e:
        logger.error(f"HTTP exception for vch_no {vch_no}: {str(e)}")
        raise e
    except Error as e:
        logger.error(f"Database error fetching inventory details for vch_no {vch_no}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error fetching inventory details for vch_no {vch_no}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()
        logger.info("Database connection closed")

@app.get("/api/po-details")
async def get_po_details():
    """Retrieve all purchase order details from the po_details table."""
    logger.info("Received request to /api/po-details")
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            logger.error("Database connection failed")
            raise HTTPException(status_code=500, detail="Database connection failed")
        cursor = conn.cursor(dictionary=True, buffered=True)
        query = """
            SELECT id, poNumber, material, supplier, quantity, rate, totalAmount, poType, deliveryDate, narration, status, createdAt, updatedAt
            FROM po_details
        """
        logger.debug(f"Executing query: {query}")
        cursor.execute(query)
        rows = cursor.fetchall()

        if not rows:
            logger.info("No purchase order details found")
            return {"status": "success", "headers": [], "data": [], "total_rows": 0}

        headers = [
            "id", "poNumber", "material", "supplier", "quantity", "rate", "totalAmount",
            "poType", "deliveryDate", "narration", "status", "createdAt", "updatedAt"
        ]
        data = [list(row.values()) for row in rows]

        logger.info(f"Retrieved {len(data)} purchase order details")
        return {
            "status": "success",
            "headers": headers,
            "data": data,
            "total_rows": len(data)
        }
    except Error as e:
        logger.error(f"Database error fetching PO details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error fetching PO details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()
        logger.info("Database connection closed")

@app.get("/get-csv-data/{csv_type}")
async def get_csv_data(csv_type: str):
    """Retrieve data from the specified CSV file (po, SupplierDetail, or indent)."""
    logger.info(f"Received request to /get-csv-data/{csv_type}")
    try:
        csv_file_map = {
            "po": CSV_PATHS["PURCHASE ORDER"],
            "SupplierDetail": CSV_PATHS["SupplierDetail"],
            "indent": CSV_PATHS["INDENT"]
        }

        if csv_type not in csv_file_map:
            logger.warning(f"Invalid CSV type: {csv_type}")
            raise HTTPException(status_code=400, detail="Invalid CSV type")

        csv_path = csv_file_map[csv_type]

        if not os.path.exists(csv_path):
            logger.info(f"CSV file not found: {csv_path}")
            return {"status": "success", "headers": [], "data": [], "total_rows": 0}

        df = pd.read_csv(csv_path)

        if df.empty:
            logger.info(f"CSV file is empty: {csv_path}")
            return {"status": "success", "headers": [], "data": [], "total_rows": 0}

        # Replace NaN, inf, -inf with empty strings
        df = df.replace({float('inf'): None, float('-inf'): None}).fillna("")

        headers = df.columns.tolist()
        data = df.values.tolist()

        logger.info(f"Retrieved CSV data: {csv_type}, {len(data)} rows")
        return {
            "status": "success",
            "headers": headers,
            "data": data,
            "total_rows": len(data)
        }
    except Exception as e:
        logger.error(f"Error reading CSV {csv_type}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading CSV: {str(e)}")

@app.get("/download/{csv_type}")
async def download_csv(csv_type: str):
    """Download the specified CSV file."""
    logger.info(f"Received request to /download/{csv_type}")
    try:
        csv_file_map = {
            "po": CSV_PATHS["PURCHASE ORDER"],
            "SupplierDetail": CSV_PATHS["SupplierDetail"],
            "indent": CSV_PATHS["INDENT"]
        }

        if csv_type not in csv_file_map:
            logger.warning(f"Invalid CSV type: {csv_type}")
            raise HTTPException(status_code=400, detail="Invalid CSV type")

        csv_path = csv_file_map[csv_type]

        if not os.path.exists(csv_path):
            logger.warning(f"CSV file not found: {csv_path}")
            raise HTTPException(status_code=404, detail="CSV file not found")

        logger.info(f"Downloading CSV: {csv_path}")
        return FileResponse(
            path=csv_path,
            filename=f"{csv_type}_data.csv",
            media_type="application/octet-stream"
        )
    except Exception as e:
        logger.error(f"Error downloading CSV {csv_type}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error downloading CSV: {str(e)}")

@app.delete("/clear-csv/{csv_type}")
async def clear_csv(csv_type: str):
    """Clear (delete) the specified CSV file."""
    logger.info(f"Received request to /clear-csv/{csv_type}")
    try:
        csv_file_map = {
            "po": CSV_PATHS["PURCHASE ORDER"],
            "SupplierDetail": CSV_PATHS["SupplierDetail"],
            "indent": CSV_PATHS["INDENT"]
        }

        if csv_type not in csv_file_map:
            logger.warning(f"Invalid CSV type: {csv_type}")
            raise HTTPException(status_code=400, detail="Invalid CSV type")

        csv_path = csv_file_map[csv_type]

        if os.path.exists(csv_path):
            os.remove(csv_path)
            logger.info(f"Cleared CSV: {csv_path}")

        return {"status": "success", "message": f"{csv_type.upper()} CSV cleared successfully"}
    except Exception as e:
        logger.error(f"Error clearing CSV {csv_type}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error clearing CSV: {str(e)}")

def clean_value(value):
    """Convert 'NULL' strings to None, handle numeric conversions, and return cleaned value."""
    if value == "NULL" or value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        # Try to convert to float if it looks like a number
        try:
            return float(value)
        except ValueError:
            return value
    return value

def parse_quantity(quantity_str):
    """Extract numeric quantity from strings like '14.000 Ton'."""
    if not quantity_str or quantity_str == "NULL":
        return 0.0
    try:
        # Use regex to extract the numeric part (including decimals)
        match = re.match(r"(\d+\.\d+|\d+)", quantity_str)
        if match:
            return float(match.group(0))
        # Split on space and take the first part
        return float(quantity_str.split()[0])
    except (ValueError, IndexError):
        return 0.0

def parse_rate(rate_str):
    """Extract numeric rate from strings like '59700.00/Ton'."""
    if not rate_str or rate_str == "NULL":
        return 0.0
    try:
        return float(rate_str.split('/')[0])
    except (ValueError, IndexError):
        return 0.0

def parse_date(date_str):
    """Parse various date formats and return YYYY-MM-DD."""
    if not date_str or date_str == "NULL":
        return None
    try:
        parsed = dateutil.parser.parse(date_str, dayfirst=False)
        return parsed.strftime('%Y-%m-%d')
    except (ValueError, TypeError):
        return None

@app.post("/upload-json/")
async def upload_json(file: UploadFile = File(...)):
    """Upload and process a JSON file containing voucher data."""
    logger.info("Received request to /upload-json/")
    conn = None
    cursor = None
    temp_file_path = None
    try:
        # Save uploaded file temporarily
        temp_file_path = f"temp_{uuid.uuid4().hex}.json"
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"Temporary file saved: {temp_file_path}")

        # Load JSON
        with open(temp_file_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                logger.info("JSON file loaded successfully")
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON format: {str(e)}")
                raise HTTPException(status_code=400, detail="Invalid JSON format")

        if "Voucher" not in data:
            logger.error("'Voucher' key missing in JSON")
            raise HTTPException(status_code=400, detail="'Voucher' key missing in JSON")

        # Group data by type for CSV
        grouped_data = {
            "SupplierDetail": [],
            "PURCHASE ORDER": [],
            "INDENT": []
        }

        # Connect to the database
        conn = get_db_connection()
        if conn is None:
            logger.error("Database connection failed")
            raise HTTPException(status_code=500, detail="Database connection failed")
        cursor = conn.cursor(buffered=True)  # Use buffered cursor

        # Prepare SQL insert queries
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
            logger.info(f"Processing voucher type: {vtype}")

            # Normalize type to known keys
            if "SUPPLIERDETAIL" in vtype:
                key = "SupplierDetail"
            elif "PURCHASE ORDER" in vtype or "PO" in vtype:
                key = "PURCHASE ORDER"
            elif "INDENT" in vtype:
                key = "INDENT"
            else:
                errors.append(f"Unknown VoucherTypeName: {vtype} for VchNo: {voucher.get('VchNo', 'Unknown')}")
                logger.warning(f"Unknown VoucherTypeName: {vtype}")
                continue

            # Clean base voucher data
            base_info = {k: clean_value(v) for k, v in voucher.items() if k not in ["Inventory Entries", "Ledgerdetails"]}

            # Insert into vouchers table
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

                logger.debug(f"Inserting voucher: VchNo={vch_no}")
                cursor.execute(insert_voucher_query, (
                    sal_time, voucher_type_name, vch_no, date, effective_date, narration, state_buyer, cancel, refund,
                    customer_name, mailing_name, customer_web_id, customer_tally_id, billing_address, consignee_name,
                    shipping_address, billing_pin_code, shipping_pin_code, billing_phone_no, shipping_phone_no,
                    total_amount, sales_tally_id, web_id, action, billing_state, billing_country, shipping_state,
                    shipping_country, created_at, updated_at
                ))
                voucher_id = cursor.lastrowid
                logger.info(f"Inserted voucher: VchNo={vch_no}, ID={voucher_id}")
            except Exception as e:
                errors.append(f"Error inserting voucher (VchNo: {voucher.get('VchNo', 'Unknown')}): {str(e)}")
                logger.error(f"Error inserting voucher: {str(e)}")
                continue

            # Handle Inventory Entries
            if "Inventory Entries" in voucher and voucher["Inventory Entries"]:
                for inventory in voucher.get("Inventory Entries", []):
                    inv_info = {k: clean_value(v) for k, v in inventory.items() if k not in ["BatchAllocations", "AccountingAllocations"]}

                    # Insert into inventory_entries
                    try:
                        stock_item = inv_info.get('StockItem', '')
                        debitor_credit = inv_info.get('DebitorCredit', '')
                        billed_qty = parse_quantity(inv_info.get('BilledQty'))
                        actual_qty = parse_quantity(inv_info.get('AcutalQty'))  # Handle typo in JSON
                        rate = parse_rate(inv_info.get('Rate'))
                        discount = float(inv_info.get('Discount', 0))
                        amount = float(inv_info.get('Amount', 0.0))

                        logger.debug(f"Inserting inventory entry: StockItem={stock_item}")
                        cursor.execute(insert_inventory_query, (
                            voucher_id, stock_item, debitor_credit, billed_qty, actual_qty, rate, discount, amount
                        ))
                        inventory_id = cursor.lastrowid
                        logger.info(f"Inserted inventory entry: StockItem={stock_item}, ID={inventory_id}")
                    except Exception as e:
                        errors.append(f"Error inserting inventory entry for VchNo: {vch_no}: {str(e)}")
                        logger.error(f"Error inserting inventory entry: {str(e)}")
                        continue

                    # Handle BatchAllocations
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

                                logger.debug(f"Inserting batch allocation: BatchName={batch_name}")
                                cursor.execute(insert_batch_query, (
                                    inventory_id, batch_name, godown_name, batch_billed_qty, batch_actual_qty,
                                    batch_rate, batch_discount, batch_amount
                                ))
                                logger.info(f"Inserted batch allocation: BatchName={batch_name}")
                            except Exception as e:
                                errors.append(f"Error inserting batch allocation for VchNo: {vch_no}: {str(e)}")
                                logger.error(f"Error inserting batch allocation: {str(e)}")
                                continue

                            if key == "PURCHASE ORDER":
                                try:
                                    poNumber = vch_no
                                    material = stock_item
                                    supplier = customer_name
                                    quantity = billed_qty
                                    rate_val = rate
                                    totalAmount = amount  # Use inventory-level amount
                                    poType = voucher_type_name
                                    deliveryDate = date
                                    narration_val = narration
                                    status = 'Active'
                                    createdAt = created_at
                                    updatedAt = created_at

                                    if not poNumber or not deliveryDate:
                                        raise ValueError(f"Missing required fields: poNumber={poNumber}, deliveryDate={deliveryDate}")

                                    logger.debug(f"Inserting purchase order: poNumber={poNumber}, material={material}")
                                    cursor.execute(insert_po_query, (
                                        poNumber, material, supplier, quantity, rate_val, totalAmount,
                                        poType, deliveryDate, narration_val, status, createdAt, updatedAt
                                    ))
                                    purchase_order_count += 1
                                    logger.info(f"Inserted purchase order: poNumber={poNumber}, material={material}")
                                except Exception as e:
                                    errors.append(
                                        f"Error inserting purchase order (VchNo: {vch_no}, StockItem: {stock_item}): {str(e)}"
                                    )
                                    logger.error(f"Error inserting purchase order: {str(e)}")
                                    continue
                    else:
                        # No batch allocations
                        combined_row = {**base_info, **inv_info}
                        grouped_data[key].append(combined_row)

                        # Insert accounting allocations if present
                        if "AccountingAllocations" in inventory and inventory["AccountingAllocations"]:
                            for accounting in inventory.get("AccountingAllocations", []):
                                try:
                                    ledger_name = clean_value(accounting.get('LedgerName', ''))
                                    acc_amount = float(clean_value(accounting.get('Amount', 0.0)))

                                    logger.debug(f"Inserting accounting allocation: LedgerName={ledger_name}")
                                    cursor.execute(insert_accounting_query, (
                                        inventory_id, ledger_name, acc_amount
                                    ))
                                    logger.info(f"Inserted accounting allocation: LedgerName={ledger_name}")
                                except Exception as e:
                                    errors.append(f"Error inserting accounting allocation for VchNo: {vch_no}: {str(e)}")
                                    logger.error(f"Error inserting accounting allocation: {str(e)}")
                                    continue

                        if key == "PURCHASE ORDER":
                            try:
                                poNumber = vch_no
                                material = stock_item
                                supplier = customer_name
                                quantity = billed_qty
                                rate_val = rate
                                totalAmount = amount  # Use inventory-level amount
                                poType = voucher_type_name
                                deliveryDate = date
                                narration_val = narration
                                status = 'Active'
                                createdAt = created_at
                                updatedAt = created_at

                                if not poNumber or not deliveryDate:
                                    raise ValueError(f"Missing required fields: poNumber={poNumber}, deliveryDate={deliveryDate}")

                                logger.debug(f"Inserting purchase order: poNumber={poNumber}, material={material}")
                                cursor.execute(insert_po_query, (
                                    poNumber, material, supplier, quantity, rate_val, totalAmount,
                                    poType, deliveryDate, narration_val, status, createdAt, updatedAt
                                ))
                                purchase_order_count += 1
                                logger.info(f"Inserted purchase order: poNumber={poNumber}, material={material}")
                            except Exception as e:
                                errors.append(
                                    f"Error inserting purchase order (VchNo: {vch_no}, StockItem: {stock_item}): {str(e)}"
                                )
                                logger.error(f"Error inserting purchase order: {str(e)}")
                                continue
            else:
                # No inventory entries
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

                        logger.debug(f"Inserting purchase order: poNumber={poNumber}, no inventory")
                        cursor.execute(insert_po_query, (
                            poNumber, material, supplier, quantity, rate_val, totalAmount,
                            poType, deliveryDate, narration_val, status, createdAt, updatedAt
                        ))
                        purchase_order_count += 1
                        logger.info(f"Inserted purchase order: poNumber={poNumber}, no inventory")
                    except Exception as e:
                        errors.append(
                            f"Error inserting purchase order (VchNo: {vch_no}): {str(e)}"
                        )
                        logger.error(f"Error inserting purchase order: {str(e)}")
                        continue

            # Handle Ledgerdetails
            if "Ledgerdetails" in voucher and voucher["Ledgerdetails"]:
                for ledger in voucher.get("Ledgerdetails", []):
                    try:
                        ledger_name = clean_value(ledger.get('Ledgername', ''))
                        debitor_credit = clean_value(ledger.get('DebitorCredit', ''))
                        amount = float(clean_value(ledger.get('Amount', 0.0)))

                        logger.debug(f"Inserting ledger detail: LedgerName={ledger_name}")
                        cursor.execute(insert_ledger_query, (
                            voucher_id, ledger_name, debitor_credit, amount
                        ))
                        ledger_id = cursor.lastrowid
                        logger.info(f"Inserted ledger detail: LedgerName={ledger_name}, ID={ledger_id}")
                    except Exception as e:
                        errors.append(f"Error inserting ledger detail for VchNo: {vch_no}: {str(e)}")
                        logger.error(f"Error inserting ledger detail: {str(e)}")
                        continue

                    # Handle BillWiseDetails
                    if "BillWiseDetails" in ledger and ledger["BillWiseDetails"]:
                        for bill in ledger.get("BillWiseDetails", []):
                            try:
                                bill_type = clean_value(bill.get('BillType', ''))
                                bill_amount = float(clean_value(bill.get('Amount', 0.0)))

                                logger.debug(f"Inserting bill wise detail: BillType={bill_type}")
                                cursor.execute(insert_bill_wise_query, (
                                    ledger_id, bill_type, bill_amount
                                ))
                                logger.info(f"Inserted bill wise detail: BillType={bill_type}")
                            except Exception as e:
                                errors.append(f"Error inserting bill wise detail for VchNo: {vch_no}: {str(e)}")
                                logger.error(f"Error inserting bill wise detail: {str(e)}")
                                continue

        # Commit database changes
        conn.commit()
        logger.info("Database changes committed")

        # Log the activity if purchase orders were inserted
        if purchase_order_count > 0:
            try:
                logger.debug(f"Inserting system log for {purchase_order_count} purchase orders")
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
                logger.info(f"Inserted system log for {purchase_order_count} purchase orders")
            except Exception as e:
                errors.append(f"Error inserting system log: {str(e)}")
                logger.error(f"Error inserting system log: {str(e)}")

        # Save to CSVs
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
                logger.info(f"Saved CSV for {vtype_key}: {csv_path}")
            except Exception as e:
                errors.append(f"Error saving CSV for {vtype_key}: {str(e)}")
                logger.error(f"Error saving CSV for {vtype_key}: {str(e)}")

        # Prepare response
        response = {
            "status": "success",
            "message": f"File processed: {purchase_order_count} records saved to po_details table, all details saved to respective tables, data also saved to CSVs.",
            "details": result
        }
        if errors:
            response["errors"] = errors
            logger.warning(f"Errors encountered during processing: {errors}")

        if not result and purchase_order_count == 0:
            logger.warning("No valid VoucherType found and no purchase orders saved")
            raise HTTPException(
                status_code=400,
                detail="No valid VoucherType found (SupplierDetail, Purchase Order, Indent) and no purchase orders saved."
            )

        logger.info("Request processed successfully")
        return response

    except HTTPException as e:
        logger.error(f"HTTP exception: {str(e)}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                logger.info(f"Temporary file removed: {temp_file_path}")
            except Exception as e:
                logger.error(f"Error removing temporary file: {str(e)}")
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()
            logger.info("Database connection closed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
