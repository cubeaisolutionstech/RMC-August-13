from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_cors import CORS
from db_config import get_db_connection
import mysql.connector
from datetime import datetime
import json
import pyodbc
import pandas_access as mdb
import pandas as pd
import os
import bcrypt
import re
import requests
from werkzeug.utils import secure_filename
import tempfile
from license_plate_service import process_vehicle_video, create_new_vehicles_table
from datetime import timedelta
import base64
from io import BytesIO
from PIL import Image

app = Flask(__name__)
CORS(app)

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200MB max file size

# Extractor service URL
EXTRACTOR_SERVICE_URL = "http://localhost:8001"

# License plate processing service URL
LICENSE_PLATE_SERVICE_URL = "http://127.0.0.1:8000"

# Function to log system activities
def log_system_activity(branch_name, module_name, action_performed, action_by, action_on, ip_address="127.0.0.1"):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            INSERT INTO system_logs (branch_name, module_name, action_performed, action_by, action_on, ip_address, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        '''
        values = (branch_name, module_name, action_performed, action_by, action_on, ip_address, datetime.now())
        
        cursor.execute(query, values)
        conn.commit()
    except Exception as e:
        print(f"Error logging system activity: {str(e)}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# Initialize database tables
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create employees table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(255) NOT NULL,
            date_of_birth DATE,
            gender ENUM('Male', 'Female', 'Other'),
            phone_number VARCHAR(15),
            email_id VARCHAR(255) UNIQUE,
            address TEXT,
            aadhar_number VARCHAR(12),
            pan_number VARCHAR(10),
            joining_date DATE,
            designation VARCHAR(100),
            department VARCHAR(100),
            emergency_contact VARCHAR(15),
            status ENUM('Active', 'Inactive') DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
        # Create user_signin table
    cursor.execute('''
   CREATE TABLE IF NOT EXISTS user_signin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(15),
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_number VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    effective_date DATE,
    narration TEXT,
    state_buyer VARCHAR(100),
    refund_status VARCHAR(20),
    total_amount DECIMAL(15,2) DEFAULT 0.00,
    sales_tally_id VARCHAR(50),
    cancel_status VARCHAR(20),
    customer_name VARCHAR(100),
    customer_web_id VARCHAR(50),
    customer_tally_id VARCHAR(50),
    billing_address TEXT,
    consignee_name VARCHAR(100),
    shipping_address TEXT,
    billing_pin_code VARCHAR(20),
    shipping_pin_code VARCHAR(20),
    billing_phone_no VARCHAR(20),
    shipping_phone_no VARCHAR(20),
    web_id VARCHAR(50),
    action VARCHAR(50),
    vehicle_number VARCHAR(20),
    empty_weight DECIMAL(10,2),
    loaded_weight DECIMAL(10,2),
    net_weight DECIMAL(10,2),
    empty_weight_date DATETIME,
    empty_weight_time TIME,
    load_weight_date DATETIME,
    load_weight_time TIME,
    pending BOOLEAN DEFAULT FALSE,
    closed BOOLEAN DEFAULT FALSE,
    exported BOOLEAN DEFAULT FALSE,
    shift VARCHAR(5),
    inventory_entries JSON,
    ledger_details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
''')
    # Create branches table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS branches (
            id INT AUTO_INCREMENT PRIMARY KEY,
            branch_name VARCHAR(255) NOT NULL,
            address TEXT,
            contact_number VARCHAR(15),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create roles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS roles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            role_name VARCHAR(100) NOT NULL,
            permissions JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create employee_login table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS employee_login (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT,
            branch_id INT,
            login_id VARCHAR(50) UNIQUE,
            password VARCHAR(255),
            role_id INT,
            status ENUM('Active', 'Inactive') DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id),
            FOREIGN KEY (branch_id) REFERENCES branches(id),
            FOREIGN KEY (role_id) REFERENCES roles(id)
        )
    ''')
    
    # Create login table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS login (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL,
            branch_id INT,
            status ENUM('Active', 'Inactive') DEFAULT 'Active',
            last_login DATETIME,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create projects table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id INT AUTO_INCREMENT PRIMARY KEY,
            project_name VARCHAR(255) NOT NULL,
            address TEXT,
            latitude DECIMAL(10, 8),
            longitude DECIMAL(11, 8),
            status ENUM('Active', 'Inactive', 'Completed') DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create po_details table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS po_details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            poNumber VARCHAR(50) NOT NULL,
            material VARCHAR(100) NOT NULL,
            supplier VARCHAR(100) NOT NULL,
            quantity DECIMAL(10,2) NOT NULL,
            rate DECIMAL(10,2) NOT NULL,
            totalAmount DECIMAL(15,2) NOT NULL,
            poType VARCHAR(50) NOT NULL,
            deliveryDate DATE NOT NULL,
            narration TEXT,
            status VARCHAR(20) DEFAULT 'Active',
            createdAt DATETIME NOT NULL,
            updatedAt DATETIME NOT NULL
        )
    ''')
        # Create vouchers table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vouchers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sal_time VARCHAR(255),
            voucher_type_name VARCHAR(255),
            vch_no VARCHAR(255),
            date DATE,
            effective_date DATE,
            narration TEXT,
            state_buyer VARCHAR(255),
            cancel VARCHAR(255),
            refund VARCHAR(255),
            customer_name VARCHAR(255),
            mailing_name VARCHAR(255),
            customer_web_id VARCHAR(255),
            customer_tally_id VARCHAR(255),
            billing_address TEXT,
            consignee_name VARCHAR(255),
            shipping_address TEXT,
            billing_pin_code VARCHAR(50),
            shipping_pin_code VARCHAR(50),
            billing_phone_no VARCHAR(50),
            shipping_phone_no VARCHAR(50),
            total_amount DECIMAL(15,2),
            sales_tally_id VARCHAR(255),
            web_id VARCHAR(255),
            action VARCHAR(255),
            billing_state VARCHAR(255),
            billing_country VARCHAR(255),
            shipping_state VARCHAR(255),
            shipping_country VARCHAR(255),
            created_at DATETIME,
            updated_at DATETIME
        )
    ''')

    # Create inventory_entries table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS inventory_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_id INT NOT NULL,
    vch_no VARCHAR(50) NOT NULL,
    stock_item VARCHAR(255),
    debitor_credit VARCHAR(50),
    billed_qty DECIMAL(15,3),
    actual_qty DECIMAL(15,3),
    rate DECIMAL(15,2),
    discount DECIMAL(15,2),
    amount DECIMAL(15,2),
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
)
''')

    # Create batch_allocations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS batch_allocations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            inventory_id INT,
            batch_name VARCHAR(255),
            godown_name VARCHAR(255),
            batch_billed_qty DECIMAL(15,3),
            batch_actual_qty DECIMAL(15,3),
            batch_rate DECIMAL(15,2),
            batch_discount DECIMAL(15,2),
            amount DECIMAL(15,2),
            FOREIGN KEY (inventory_id) REFERENCES inventory_entries(id)
        )
    ''')

    # Create accounting_allocations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS accounting_allocations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            inventory_id INT,
            ledger_name VARCHAR(255),
            amount DECIMAL(15,2),
            FOREIGN KEY (inventory_id) REFERENCES inventory_entries(id)
        )
    ''')

    # Create ledger_details table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ledger_details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            voucher_id INT,
            ledger_name VARCHAR(255),
            debitor_credit VARCHAR(50),
            amount DECIMAL(15,2),
            FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
        )
    ''')

    # Create bill_wise_details table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bill_wise_details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ledger_id INT,
            bill_type VARCHAR(255),
            bill_amount DECIMAL(15,2),
            FOREIGN KEY (ledger_id) REFERENCES ledger_details(id)
        )
    ''')

    # Create system_logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            branch_name VARCHAR(255),
            module_name VARCHAR(255),
            action_performed VARCHAR(255),
            action_by VARCHAR(255),
            action_on TEXT,
            ip_address VARCHAR(50),
            timestamp DATETIME
        )
    ''')
    # Create ticket_details table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ticket_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        TicketNumber VARCHAR(50) NOT NULL,
        VehicleNumber VARCHAR(50) NOT NULL,
        `Date` DATE NOT NULL,
        `Time` TIME NOT NULL,
        LoadedWeight DECIMAL(10,2) NOT NULL,
        EmptyWeight DECIMAL(10,2) NOT NULL,
        LoadWeightDate DATE,
        LoadWeightTime TIME,
        EmptyWeightDate DATE,
        EmptyWeightTime TIME,
        NetWeight DECIMAL(10,2) NOT NULL,
        Pending VARCHAR(20),
        `Shift` VARCHAR(20),
        Materialname VARCHAR(100),
        SupplierName VARCHAR(100),
        `State` VARCHAR(50),
        Closed VARCHAR(20),
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
    ''')
    
#Creating or updating the invoice_items table
    cursor.execute('''
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
    gstin VARCHAR(20),
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
);
''')
    
    # Create weighbridge_data table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS weighbridge_data (
                   id INT AUTO_INCREMENT PRIMARY KEY,
    TicketNumber INT,
    VehicleNumber VARCHAR(20),
    Date DATETIME,
    Time DATETIME,
    EmptyWeight DECIMAL(10,2),
    LoadedWeight DECIMAL(10,2),
    EmptyWeightDate DATETIME,
    EmptyWeightTime DATETIME,
    LoadWeightDate DATETIME,
    LoadWeightTime DATETIME,
    NetWeight DECIMAL(10,2),
    Pending BOOLEAN,
    Closed BOOLEAN,
    Exported BOOLEAN,
    Shift VARCHAR(5),
    MaterialName VARCHAR(100),
    SupplierName VARCHAR(100),
    State VARCHAR(100),
    Blank VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS supplier (
    id INT AUTO_INCREMENT PRIMARY KEY,
    poNumber VARCHAR(50) NOT NULL,
    poBalanceQty DECIMAL(10,2) NOT NULL,
    inwardNo VARCHAR(50) NOT NULL,
    vehicleNo VARCHAR(50) NOT NULL,
    dateTime DATETIME NOT NULL,
    supplierName VARCHAR(255) NOT NULL,
    material VARCHAR(255) NOT NULL,
    uom VARCHAR(50) DEFAULT 'tons',
    orderedQty DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    receivedQty DECIMAL(10,2),
    receivedBy VARCHAR(255),
    supplierBillQty DECIMAL(10,2),
    poRate DECIMAL(10,2) NOT NULL,
    supplierBillRate DECIMAL(10,2),
    supplierBillFile VARCHAR(255),
    difference DECIMAL(10,2),
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
                   ''')

    # Create supplier table
    # cursor.execute('''
    #     CREATE TABLE IF NOT EXISTS supplier (
    #         id INT AUTO_INCREMENT PRIMARY KEY,
    #         poNumber VARCHAR(50) NOT NULL,
    #         poBalanceQty DECIMAL(10,2) NOT NULL,
    #         inwardNo VARCHAR(50) NOT NULL,
    #         vehicleNo VARCHAR(50) NOT NULL,
    #         dateTime DATETIME NOT NULL,
    #         supplierName VARCHAR(255) NOT NULL,
    #         material VARCHAR(255) NOT NULL,
    #         uom VARCHAR(50) DEFAULT 'tons',
    #         receivedQty DECIMAL(10,2),
    #         receivedBy VARCHAR(255),
    #         supplierBillQty DECIMAL(10,2),
    #         poRate DECIMAL(10,2) NOT NULL,
    #         supplierBillRate DECIMAL(10,2),
    #         supplierBillFile VARCHAR(255),
    #         difference DECIMAL(10,2),
    #         status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    #         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    #         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    #     )
    # ''')
    
    # Create vehicles table with updated structure
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vehicles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sno INT,
            inward_no VARCHAR(50),
            vehicle_number VARCHAR(50) NOT NULL,
            supplier_name VARCHAR(255),
            material VARCHAR(255),
            entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX(sno),
            INDEX(vehicle_number)
        )
    ''')
    
    # Create system_logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sno INT,
            branch_name VARCHAR(255),
            module_name VARCHAR(255),
            action_performed VARCHAR(100),
            action_by VARCHAR(255),
            action_on VARCHAR(255),
            timestamp DATETIME,
            ip_address VARCHAR(45),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX(sno)
        )
    ''')
    
    # Create batch_slips table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS batch_slips (
            id INT AUTO_INCREMENT PRIMARY KEY,
            plant_serial_number VARCHAR(50),
            batch_date DATE,
            batch_start_time TIME,
            batch_end_time TIME,
            batch_number VARCHAR(50) UNIQUE,
            customer VARCHAR(255),
            site VARCHAR(255),
            recipe_code VARCHAR(50),
            recipe_name VARCHAR(255),
            truck_number VARCHAR(50),
            truck_driver VARCHAR(255),
            order_number VARCHAR(50),
            batcher_name VARCHAR(255),
            ordered_quantity DECIMAL(10, 2),
            production_quantity DECIMAL(10, 2),
            adj_manual_quantity DECIMAL(10, 2),
            with_this_load DECIMAL(10, 2),
            mixer_capacity DECIMAL(10, 2),
            batch_size DECIMAL(10, 2),
            client_name VARCHAR(255),
            client_address TEXT,
            client_email VARCHAR(255),
            client_gstin VARCHAR(50),
            description VARCHAR(255),
            hsn_code VARCHAR(20),
            quantity DECIMAL(10, 2),
            rate DECIMAL(10, 2),
            unit VARCHAR(20),
            status ENUM('Active', 'Completed', 'Cancelled') DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create invoices table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_number VARCHAR(50) UNIQUE,
            batch_slip_id INT,
            client_name VARCHAR(255),
            client_address TEXT,
            client_email VARCHAR(255),
            client_gstin VARCHAR(50),
            description VARCHAR(255),
            hsn_code VARCHAR(20),
            quantity DECIMAL(10, 2),
            rate DECIMAL(10, 2),
            unit VARCHAR(20),
            total_amount DECIMAL(12, 2),
            cgst DECIMAL(12, 2),
            sgst DECIMAL(12, 2),
            grand_total DECIMAL(12, 2),
            amount_in_words TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_slip_id) REFERENCES batch_slips(id)
        )
    ''')
    
    # Create grn table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS grn (
            id INT AUTO_INCREMENT PRIMARY KEY,
            grnNumber VARCHAR(50),
            poNumber VARCHAR(50),
            supplier VARCHAR(255),
            material VARCHAR(255),
            orderedQty DECIMAL(10, 2),
            receivedQty DECIMAL(10, 2),
            rate DECIMAL(10, 2),
            totalAmount DECIMAL(15, 2),
            receivedDate DATE,
            status VARCHAR(50) DEFAULT 'Received',
            remarks TEXT,
            grn_number VARCHAR(50) UNIQUE,
            linked_po_number VARCHAR(50),
            supplier_name VARCHAR(255),
            project VARCHAR(255),
            received_quantity DECIMAL(10, 2),
            received_date DATE,
            material_condition ENUM('Good', 'Damaged', 'Partially Damaged', 'Rejected'),
            supporting_document VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create intents table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS intents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            intentNumber VARCHAR(50) NOT NULL,
            supplier VARCHAR(100) NOT NULL,
            material VARCHAR(100) NOT NULL,
            quantity DECIMAL(10,2) NOT NULL,
            rate DECIMAL(10,2) NOT NULL,
            totalAmount DECIMAL(15,2) NOT NULL,
            deliveryDate DATE NOT NULL,
            narration TEXT,
            status VARCHAR(20) DEFAULT 'Active',
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create po_payments table for tracking PO payments
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS po_payments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            po_id INT,
            po_number VARCHAR(50),
            payment_amount DECIMAL(15, 2),
            payment_date DATE,
            payment_method VARCHAR(50),
            reference_number VARCHAR(100),
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (po_id) REFERENCES po_details(id)
        )
    ''')
    
    # Create invoice_payments table for tracking invoice payments
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoice_payments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_id INT,
            invoice_number VARCHAR(50),
            payment_amount DECIMAL(15, 2),
            payment_date DATE,
            payment_method VARCHAR(50),
            reference_number VARCHAR(100),
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        )
    ''')
    
    # Create supplier_payment_details table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS supplier_payment_details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            po_number VARCHAR(50) NOT NULL,
            supplier_name VARCHAR(255) NOT NULL,
            material VARCHAR(255) NOT NULL,
            quantity_ordered DECIMAL(10,2) NOT NULL,
            total_amount DECIMAL(15,2) NOT NULL,
            paid_amount DECIMAL(15,2) NOT NULL,
            pending_amount DECIMAL(15,2) NOT NULL,
            payment_status VARCHAR(50) DEFAULT 'Pending',
            payment_date DATE,
            payment_method VARCHAR(50),
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    # Create invoice_payment_details table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoice_payment_details (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_number VARCHAR(50) NOT NULL,
            client_name VARCHAR(255) NOT NULL,
            material VARCHAR(255) NOT NULL,
            quantity_ordered DECIMAL(10,2) NOT NULL,
            total_amount DECIMAL(15,2) NOT NULL,
            received_amount DECIMAL(15,2) NOT NULL,
            pending_amount DECIMAL(15,2) NOT NULL,
            payment_date DATE,
            payment_method VARCHAR(50),
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    cursor.close()
    conn.close()

# Function to automatically create supplier details when vehicle is added
def auto_create_supplier_detail(vehicle_data):
    print("Creating supplier detail...")
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get PO data based on supplier and material
        cursor.execute('''
            SELECT poNumber, supplier, material, quantity, rate, 
                   (quantity - COALESCE((SELECT SUM(supplierBillQty) FROM supplier 
                                       WHERE poNumber = po_details.poNumber AND supplierBillQty IS NOT NULL), 0)) as balance_qty
            FROM po_details 
            WHERE supplier = %s AND material = %s AND status = 'Active'
            ORDER BY createdAt DESC LIMIT 1
        ''', (vehicle_data['supplier_name'], vehicle_data['material']))
        po_data = cursor.fetchone()
        
        if not po_data:
            print(f"No PO found for supplier: {vehicle_data['supplier_name']}, material: {vehicle_data['material']}")
            # Create a default supplier detail even without PO
            supplier_detail = {
                'poNumber': 'AUTO-' + vehicle_data.get('inward_no', 'TEMP'),
                'poBalanceQty': 0,
                'inwardNo': vehicle_data['inward_no'],
                'vehicleNo': vehicle_data['vehicle_number'],
                'dateTime': vehicle_data['entry_time'],
                'supplierName': vehicle_data['supplier_name'],
                'material': vehicle_data['material'],
                'uom': 'tons',
                'receivedQty': 0,
                'receivedBy': 'System Auto',
                'poRate': 0,
                'status': 'Pending'
            }
        else:
            # Create supplier detail with PO data
            supplier_detail = {
                'poNumber': po_data['poNumber'],
                'poBalanceQty': float(po_data['balance_qty']) if po_data['balance_qty'] else float(po_data['quantity']),
                'inwardNo': vehicle_data['inward_no'],
                'vehicleNo': vehicle_data['vehicle_number'],
                'dateTime': vehicle_data['entry_time'],
                'supplierName': vehicle_data['supplier_name'],
                'material': vehicle_data['material'],
                'uom': 'tons',
                'receivedQty': 1,
                'receivedBy': 'System Auto',
                'poRate': float(po_data['rate']) if po_data['rate'] else 0,
                'status': 'Pending'
            }
        
        # Check if supplier detail already exists for this vehicle
        cursor.execute('''
            SELECT id FROM supplier WHERE vehicleNo = %s AND inwardNo = %s
        ''', (vehicle_data['vehicle_number'], vehicle_data['inward_no']))
        existing = cursor.fetchone()
        
        if existing:
            print(f"Supplier detail already exists for vehicle: {vehicle_data['vehicle_number']}")
            cursor.close()
            conn.close()
            return
        
        query = '''
            INSERT INTO supplier (poNumber, poBalanceQty, inwardNo, vehicleNo, dateTime,
            supplierName, material, uom, receivedQty, receivedBy, poRate, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        
        values = (
            supplier_detail['poNumber'], supplier_detail['poBalanceQty'], 
            supplier_detail['inwardNo'], supplier_detail['vehicleNo'],
            supplier_detail['dateTime'], supplier_detail['supplierName'], 
            supplier_detail['material'], supplier_detail['uom'],
            supplier_detail['receivedQty'], supplier_detail['receivedBy'], 
            supplier_detail['poRate'], supplier_detail['status']
        )
        
        cursor.execute(query, values)
        conn.commit()
        
        print(f"Auto-created supplier detail for vehicle: {vehicle_data['vehicle_number']}")
        
    except Exception as e:
        print(f"Error auto-creating supplier detail: {str(e)}")
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/batch-slips', methods=['POST'])
def create_batch_slip():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()

        query = '''
            INSERT INTO batch_slips (
                plant_serial_number, batch_date, batch_start_time, batch_end_time,
                batch_number, customer, site, recipe_code, recipe_name, truck_number,
                truck_driver, order_number, batcher_name, ordered_quantity, production_quantity,
                adj_manual_quantity, with_this_load, mixer_capacity, batch_size, client_name,
                client_address, client_email, client_gstin, description, hsn_code,
                quantity, rate, unit
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s
            )
        '''

        values = (
            data['plantSerialNumber'], data['batchDate'], data['batchStartTime'], data['batchEndTime'],
            data['batchNumber'], data['customer'], data['site'], data['recipeCode'], data['recipeName'], data['truckNumber'],
            data['truckDriver'], data['orderNumber'], data['batcherName'], data['orderedQuantity'], data['productionQuantity'],
            data['adjManualQuantity'], data['withThisLoad'], data['mixerCapacity'], data['batchSize'], data['clientName'],
            data['clientAddress'], data['clientEmail'], data['clientGSTIN'], data['description'], data['hsn'],
            data['quantity'], data['rate'], data['unit']
        )

        cursor.execute(query, values)
        conn.commit()
        
        return jsonify({"message": "Batch slip created successfully!"}), 201

    except Exception as e:
        print(f"Error creating batch slip: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# Login Authentication Route
# @app.route('/login', methods=['POST'])
# def login():
#     data = request.json
#     username = data.get('username')
#     password = data.get('password')
    
#     if not username or not password:
#         return jsonify({'error': 'Username and password required'}), 400
    
#     conn = get_db_connection()
#     cursor = conn.cursor(dictionary=True)
    
#     query = '''
#         SELECT l.*, e.full_name, b.branch_name 
#         FROM login l
#         LEFT JOIN employees e ON l.employee_id = e.id
#         LEFT JOIN branches b ON l.branch_id = b.id
#         WHERE l.username = %s AND l.password = %s AND l.status = 'Active'
#     '''
    
#     cursor.execute(query, (username, password))
#     user = cursor.fetchone()
    
#     if user:
#         # Update last login
#         cursor.execute('UPDATE login SET last_login = %s WHERE id = %s', 
#                       (datetime.now(), user['id']))
#         conn.commit()
        
#         # Log login activity
#         log_system_activity(
#             user.get('branch_name', 'Main Branch'),
#             'System',
#             'Login',
#             username,
#             'System Login',
#             request.remote_addr
#         )
        
#         return jsonify({
#             'success': True,
#             'user': {
#                 'id': user['id'],
#                 'username': user['username'],
#                 'role': user['role'],
#                 'full_name': user['full_name'],
#                 'branch_name': user['branch_name']
#             }
#         })
#     else:
#         return jsonify({'error': 'Invalid credentials'}), 401
    # finally:
    #     if 'cursor' in locals():
    #         cursor.close()
    #     if 'conn' in locals():
    #         conn.close()
# New route to fetch weighbridge_data
@app.route('/weighbridge-data', methods=['GET'])
def get_weighbridge_data():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get query parameters for filtering (optional)
        date_from = request.args.get('dateFrom')
        date_to = request.args.get('dateTo')
        vehicle_number = request.args.get('vehicleNumber')
        material_name = request.args.get('materialName')
        supplier_name = request.args.get('supplierName')
        shift = request.args.get('shift')
        
        # Build query with filters, using exact column names from DESCRIBE
        query = '''
            SELECT id, TicketNumber, VehicleNumber, Date, Time, EmptyWeight, LoadedWeight,
                   EmptyWeightDate, EmptyWeightTime, LoadWeightDate, LoadWeightTime,
                   NetWeight, Pending, Closed, Exported, Shift, Materialname, SupplierName,
                   State, Blank, created_at
            FROM weighbridge_data
            WHERE 1=1
        '''
        params = []
        
        if date_from:
            query += ' AND DATE(Date) >= %s'
            params.append(date_from)
        
        if date_to:
            query += ' AND DATE(Date) <= %s'
            params.append(date_to)
        
        if vehicle_number:
            query += ' AND VehicleNumber LIKE %s'
            params.append(f'%{vehicle_number}%')
        
        if material_name:
            query += ' AND Materialname LIKE %s'
            params.append(f'%{material_name}%')
        
        if supplier_name:
            query += ' AND SupplierName LIKE %s'
            params.append(f'%{supplier_name}%')
        
        if shift:
            query += ' AND Shift = %s'
            params.append(shift)
        
        query += ' ORDER BY created_at DESC'
        
        cursor.execute(query, params)
        weighbridge_data = cursor.fetchall()
        
        # Format the data for JSON response
        formatted_data = []
        for record in weighbridge_data:
            formatted_record = {
                'id': record['id'],
                'ticketNumber': record['TicketNumber'],
                'vehicleNumber': record['VehicleNumber'],
                'date': record['Date'].isoformat() if record['Date'] else None,
                'time': record['Time'].strftime('%H:%M:%S') if record['Time'] else None,
                'emptyWeight': float(record['EmptyWeight']) if record['EmptyWeight'] is not None else None,
                'loadedWeight': float(record['LoadedWeight']) if record['LoadedWeight'] is not None else None,
                'emptyWeightDate': record['EmptyWeightDate'].isoformat() if record['EmptyWeightDate'] else None,
                'emptyWeightTime': record['EmptyWeightTime'].strftime('%H:%M:%S') if record['EmptyWeightTime'] else None,
                'loadWeightDate': record['LoadWeightDate'].isoformat() if record['LoadWeightDate'] else None,
                'loadWeightTime': record['LoadWeightTime'].strftime('%H:%M:%S') if record['LoadWeightTime'] else None,
                'netWeight': float(record['NetWeight']) if record['NetWeight'] is not None else None,
                'pending': bool(record['Pending']) if record['Pending'] is not None else None,
                'closed': bool(record['Closed']) if record['Closed'] is not None else None,
                'exported': bool(record['Exported']) if record['Exported'] is not None else None,
                'shift': record['Shift'],
                'materialName': record['Materialname'],  # Use exact column name
                'supplierName': record['SupplierName'],
                'state': record['State'],
                'blank': record['Blank'],
                'createdAt': record['created_at'].isoformat() if record['created_at'] else None
            }
            formatted_data.append(formatted_record)
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'Weighbridge Data',
            'View',
            'System',
            'Fetched weighbridge data',
            request.remote_addr
        )
        
        return jsonify(formatted_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# Ticket Details Routes
@app.route('/ticket-details', methods=['GET'])
def get_ticket_details():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM ticket_details ORDER BY createdAt DESC")
        ticket_details = cursor.fetchall()
        
        # Format dates and times for JSON response
        for ticket in ticket_details:
            # Handle Date fields (expected to be datetime.date or datetime.datetime)
            ticket['Date'] = ticket['Date'].isoformat() if ticket['Date'] else None
            ticket['LoadWeightDate'] = ticket['LoadWeightDate'].isoformat() if ticket['LoadWeightDate'] else None
            ticket['EmptyWeightDate'] = ticket['EmptyWeightDate'].isoformat() if ticket['EmptyWeightDate'] else None
            ticket['createdAt'] = ticket['createdAt'].isoformat() if ticket['createdAt'] else None
            ticket['updatedAt'] = ticket['updatedAt'].isoformat() if ticket['updatedAt'] else None

            # Handle Time fields (check for timedelta or time)
            def format_time_field(field):
                if isinstance(field, timedelta):
                    # Convert timedelta to HH:MM:SS
                    total_seconds = int(field.total_seconds())
                    hours, remainder = divmod(total_seconds, 3600)
                    minutes, seconds = divmod(remainder, 60)
                    return f"{hours:02}:{minutes:02}:{seconds:02}"
                elif hasattr(field, 'strftime'):
                    # If it's a time or datetime object, use strftime
                    return field.strftime('%H:%M:%S')
                return None

            ticket['Time'] = format_time_field(ticket['Time']) if ticket['Time'] else None
            ticket['LoadWeightTime'] = format_time_field(ticket['LoadWeightTime']) if ticket['LoadWeightTime'] else None
            ticket['EmptyWeightTime'] = format_time_field(ticket['EmptyWeightTime']) if ticket['EmptyWeightTime'] else None
        
        log_system_activity(
            'Main Branch',
            'Ticket Details',
            'View',
            'System',
            'Fetched all ticket details',
            request.remote_addr
        )
        return jsonify(ticket_details), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/ticket-details', methods=['POST'])
def create_ticket_detail():
    try:
        if 'file' not in request.files:
            print("No file uploaded")
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            print("No file selected")
            return jsonify({'error': 'No file selected'}), 400

        if not file.filename.lower().endswith(('.mdb', '.xlsx', '.xls')):
            return jsonify({'error': 'Unsupported file type. Use .mdb or .xlsx'}), 400

        filename = secure_filename(file.filename)
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(temp_path)

        if filename.lower().endswith('.mdb'):
            try:
                conn_str = r'DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=' + temp_path + ';'
                conn = pyodbc.connect(conn_str)
                cursor = conn.cursor()
                tables = [table.table_name for table in cursor.tables(tableType='TABLE')]
                print(f"Tables in .mdb file: {tables}")
                if 'Tickets' not in tables:
                    conn.close()
                    os.remove(temp_path)
                    return jsonify({'error': 'Table "Tickets" not found in .mdb file'}), 400
                df = pd.read_sql("SELECT * FROM Tickets", conn)
                conn.close()
                print(f"Read {len(df)} rows from .mdb file: {filename}")
            except pyodbc.Error as e:
                print(f"Error reading .mdb file: {str(e)}")
                os.remove(temp_path)
                return jsonify({'error': f'Failed to read .mdb file: {str(e)}'}), 500
        else:
            df = pd.read_excel(temp_path, sheet_name='Tickets')
            print(f"Read {len(df)} rows from Excel file: {filename}")

        print(f"Columns in DataFrame: {df.columns.tolist()}")

        # Connect to MySQL database
        conn = get_db_connection()
        cursor = conn.cursor()

        inserted_rows = 0
        failed_rows = []
        date_formats = ['%d/%m/%y', '%m/%d/%y', '%Y-%m-%d', '%Y-%m-%d %H:%M:%S']

        def format_time_field(field):
            if isinstance(field, pd.Timedelta):
                total_seconds = int(field.total_seconds())
                hours, remainder = divmod(total_seconds, 3600)
                minutes, seconds = divmod(remainder, 60)
                return f"{hours:02}:{minutes:02}:{seconds:02}"
            elif isinstance(field, str) and field != 'nan':
                try:
                    # Handle HH:MM:SS or H:MM:SS
                    return datetime.strptime(field, '%H:%M:%S').strftime('%H:%M:%S') if ':' in field else field
                except ValueError:
                    try:
                        # Handle 12-hour format (e.g., 2:30 PM)
                        return datetime.strptime(field, '%I:%M %p').strftime('%H:%M:%S')
                    except ValueError:
                        try:
                            # Handle datetime string (e.g., 2025-01-04 14:30:00)
                            return datetime.strptime(field, '%Y-%m-%d %H:%M:%S').strftime('%H:%M:%S')
                        except ValueError:
                            return None
            elif hasattr(field, 'strftime'):  # datetime.time or datetime.datetime
                return field.strftime('%H:%M:%S')
            return None

        for index, row in df.iterrows():
            try:
                # Log raw values for debugging
                print(f"Row {index + 1}: Date={row['Date']}, Time={row['Time']}, "
                      f"LoadWeightDate={row['LoadWeightDate']}, LoadWeightTime={row['LoadWeightTime']}, "
                      f"EmptyWeightDate={row['EmptyWeightDate']}, EmptyWeightTime={row['EmptyWeightTime']}")

                # Parse Date
                date_str = str(row['Date']).strip()
                date_value = None
                if pd.notnull(row['Date']) and date_str != 'nan':
                    for fmt in date_formats:
                        try:
                            # Try parsing full string first
                            date_value = datetime.strptime(date_str, fmt).strftime('%Y-%m-%d')
                            break
                        except ValueError:
                            try:
                                # Try parsing date part only (e.g., 2025-01-04 from 2025-01-04 00:00:00)
                                date_value = datetime.strptime(date_str.split(' ')[0], fmt).strftime('%Y-%m-%d')
                                break
                            except ValueError:
                                continue
                    if date_value is None:
                        raise ValueError(f"Invalid date format: {date_str}")

                if date_value is None:
                    raise ValueError("Missing or invalid Date")

                # Parse Time
                time_value = format_time_field(row['Time']) if pd.notnull(row['Time']) else None
                if time_value is None:
                    raise ValueError("Missing or invalid Time")

                # Parse LoadedWeight
                loaded_weight_str = str(row['LoadedWeight']).strip()
                loaded_weight = float(loaded_weight_str) if loaded_weight_str != 'nan' else 0.0

                # Parse EmptyWeight
                empty_weight_str = str(row['EmptyWeight']).strip()
                empty_weight = float(empty_weight_str) if empty_weight_str != 'nan' else 0.0

                # Parse LoadWeightDate
                load_weight_date_str = str(row['LoadWeightDate']).strip()
                load_weight_date_value = None
                if pd.notnull(row['LoadWeightDate']) and load_weight_date_str != 'nan':
                    for fmt in date_formats:
                        try:
                            load_weight_date_value = datetime.strptime(load_weight_date_str, fmt).strftime('%Y-%m-%d')
                            break
                        except ValueError:
                            try:
                                load_weight_date_value = datetime.strptime(load_weight_date_str.split(' ')[0], fmt).strftime('%Y-%m-%d')
                                break
                            except ValueError:
                                continue

                # Parse LoadWeightTime
                load_weight_time_value = format_time_field(row['LoadWeightTime']) if pd.notnull(row['LoadWeightTime']) else None

                # Parse EmptyWeightDate
                empty_weight_date_str = str(row['EmptyWeightDate']).strip()
                empty_weight_date_value = None
                if pd.notnull(row['EmptyWeightDate']) and empty_weight_date_str != 'nan':
                    for fmt in date_formats:
                        try:
                            empty_weight_date_value = datetime.strptime(empty_weight_date_str, fmt).strftime('%Y-%m-%d')
                            break
                        except ValueError:
                            try:
                                empty_weight_date_value = datetime.strptime(empty_weight_date_str.split(' ')[0], fmt).strftime('%Y-%m-%d')
                                break
                            except ValueError:
                                continue

                # Parse EmptyWeightTime
                empty_weight_time_value = format_time_field(row['EmptyWeightTime']) if pd.notnull(row['EmptyWeightTime']) else None

                # Parse NetWeight
                net_weight_str = str(row['NetWeight']).strip()
                net_weight = float(net_weight_str) if net_weight_str != 'nan' else 0.0

                # Other fields
                ticket_number = str(row['TicketNumber']) if pd.notnull(row['TicketNumber']) else None
                vehicle_number = str(row['VehicleNumber']) if pd.notnull(row['VehicleNumber']) else None
                pending = str(row['Pending']) if pd.notnull(row['Pending']) else None
                shift = str(row['Shift']) if pd.notnull(row['Shift']) else None
                material_name = str(row['Materialname']) if pd.notnull(row['Materialname']) else None
                supplier_name = str(row['SupplierName']) if pd.notnull(row['SupplierName']) else None
                state = str(row['State']) if pd.notnull(row['State']) else None
                closed = str(row['Closed']) if pd.notnull(row['Closed']) else None

                # Check NOT NULL fields
                if not all([ticket_number, vehicle_number, date_value, time_value]):
                    raise ValueError(f"Missing NOT NULL fields: {', '.join([f for f, v in zip(['TicketNumber', 'VehicleNumber', 'Date', 'Time'], [ticket_number, vehicle_number, date_value, time_value]) if not v])}")

                query = '''
                    INSERT INTO ticket_details (
                        TicketNumber, VehicleNumber, `Date`, `Time`, LoadedWeight, EmptyWeight,
                        LoadWeightDate, LoadWeightTime, EmptyWeightDate, EmptyWeightTime,
                        NetWeight, Pending, `Shift`, Materialname, SupplierName, `State`, Closed
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                '''
                values = (
                    ticket_number, vehicle_number, date_value, time_value, loaded_weight, empty_weight,
                    load_weight_date_value, load_weight_time_value, empty_weight_date_value, empty_weight_time_value,
                    net_weight, pending, shift, material_name, supplier_name, state, closed
                )
                cursor.execute(query, values)
                inserted_rows += 1
                print(f"Inserted row {index + 1}: TicketNumber={ticket_number}")
            except Exception as e:
                print(f"Error inserting row {index + 1}: {str(e)}")
                failed_rows.append(f"Row {index + 1}: {str(e)}")

        conn.commit()
        print(f"Inserted {inserted_rows} rows successfully, {len(failed_rows)} rows failed")

        log_system_activity(
            'Main Branch',
            'Ticket Details',
            'Create from MDB/Excel',
            'System',
            f"Processed file {filename}, inserted {inserted_rows} rows",
            request.remote_addr
        )

        os.remove(temp_path)
        if inserted_rows == 0:
            return jsonify({'error': 'No rows inserted', 'failed_rows': failed_rows}), 400
        return jsonify({
            'message': 'Ticket details from file created successfully',
            'inserted_rows': inserted_rows,
            'failed_rows': failed_rows
        }), 201

    except Exception as e:
        print(f"Error occurred: {str(e)}")
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
@app.route('/ticket-details/<int:id>', methods=['PUT'])
def update_ticket_detail(id):
    try:
        data = request.json
        required_fields = ['TicketNumber', 'VehicleNumber', 'Date', 'Time', 'LoadedWeight', 'EmptyWeight', 'NetWeight']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            UPDATE ticket_details SET
                TicketNumber=%s, VehicleNumber=%s, `Date`=%s, `Time`=%s, LoadedWeight=%s,
                EmptyWeight=%s, LoadWeightDate=%s, LoadWeightTime=%s, EmptyWeightDate=%s,
                EmptyWeightTime=%s, NetWeight=%s, Pending=%s, `Shift`=%s, Materialname=%s,
                SupplierName=%s, `State`=%s, Closed=%s, updatedAt=%s
            WHERE id=%s
        '''
        values = (
            data['TicketNumber'],
            data['VehicleNumber'],
            data['Date'],
            data['Time'],
            float(data['LoadedWeight']),
            float(data['EmptyWeight']),
            data.get('LoadWeightDate'),
            data.get('LoadWeightTime'),
            data.get('EmptyWeightDate'),
            data.get('EmptyWeightTime'),
            float(data['NetWeight']),
            data.get('Pending'),
            data.get('Shift'),
            data.get('Materialname'),
            data.get('SupplierName'),
            data.get('State'),
            data.get('Closed'),
            datetime.now(),
            id
        )
        
        cursor.execute(query, values)
        if cursor.rowcount == 0:
            return jsonify({'error': 'Ticket detail not found'}), 404
        
        conn.commit()
        
        log_system_activity(
            'Main Branch',
            'Ticket Details',
            'Update',
            'System',
            f"Ticket ID {id}",
            request.remote_addr
        )
        return jsonify({'message': 'Ticket detail updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/ticket-details/<int:id>', methods=['DELETE'])
def delete_ticket_detail(id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT TicketNumber FROM ticket_details WHERE id = %s', (id,))
        ticket = cursor.fetchone()
        if not ticket:
            return jsonify({'error': 'Ticket detail not found'}), 404
        
        cursor.execute('DELETE FROM ticket_details WHERE id = %s', (id,))
        conn.commit()
        
        log_system_activity(
            'Main Branch',
            'Ticket Details',
            'Delete',
            'System',
            f"Ticket {ticket[0]}",
            request.remote_addr
        )
        return jsonify({'message': 'Ticket detail deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()            
@app.route('/vehicles/process-video', methods=['POST'])
def process_video():
    """
    Updated video processing route that integrates with license plate detection
    and material detection Python scripts
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, filename)
        file.save(temp_path)
        
        try:
            # Process the video using the integrated Python scripts
            result = process_vehicle_video(temp_path)
            
            # Clean up temporary file
            os.remove(temp_path)
            
            if result['success']:
                if result['matched']:
                    # Vehicle exists in database
                    return jsonify({
                        'success': True,
                        'matched': True,
                        'vehicle_number': result['vehicle_number'],
                        'existing_vehicle': result['existing_vehicle'],
                        'message': 'Vehicle matched in database'
                    })
                else:
                    # New vehicle detected
                    return jsonify({
                        'success': True,
                        'matched': False,
                        'vehicle_number': result['vehicle_number'],
                        'vehicle_data': result['vehicle_data'],
                        'message': 'New vehicle detected, please fill remaining details'
                    })
            else:
                return jsonify({
                    'success': False,
                    'error': result['error']
                }), 400
                
        except Exception as e:
            # Clean up temporary file in case of error
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({
                'success': False,
                'error': f'Processing error: {str(e)}'
            }), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/vehicles', methods=['POST'])
def create_vehicle():
    """
    Updated vehicle creation route for the new table structure
    """
    try:
        data = request.json
        print(f"Received vehicle data: {data}")  # Debug log
        
        # Validate required fields
        if not data or 'vehicle_number' not in data:
            return jsonify({"error": "vehicle_number is required"}), 400
            
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Generate serial number
        cursor.execute('SELECT MAX(sno) FROM vehicles')
        result = cursor.fetchone()
        max_sno = result['MAX(sno)'] if result and result['MAX(sno)'] else 0
        new_sno = max_sno + 1

        # Generate inward number like INWB001
        inward_no = f"INWB{str(new_sno).zfill(3)}"

        # Check if vehicle already exists
        cursor.execute('SELECT * FROM vehicles WHERE vehicle_number = %s', (data['vehicle_number'],))
        existing_vehicle = cursor.fetchone()

        if existing_vehicle:
            # Update existing vehicle entry
            query = '''
                UPDATE vehicles 
                SET supplier_name = COALESCE(%s, supplier_name),
                    material = COALESCE(%s, material),
                    inward_no = COALESCE(%s, inward_no),
                    entry_time = %s
                WHERE vehicle_number = %s
            '''
            values = (
                data.get('supplier_name'),
                data.get('material'),
                inward_no,
                data.get('entry_time', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                data['vehicle_number']
            )
            cursor.execute(query, values)
            message = "Vehicle entry updated successfully"
            
            # Get updated vehicle data for supplier creation
            cursor.execute('SELECT * FROM vehicles WHERE vehicle_number = %s', (data['vehicle_number'],))
            vehicle_data = cursor.fetchone()
        else:
            # Create new vehicle entry
            query = '''
                INSERT INTO vehicles (sno, inward_no, vehicle_number, supplier_name, material, entry_time)
                VALUES (%s, %s, %s, %s, %s, %s)
            '''
            values = (
                new_sno,
                inward_no,
                data['vehicle_number'],
                data.get('supplier_name'),
                data.get('material'),
                data.get('entry_time', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
            )

            cursor.execute(query, values)
            message = "Vehicle entry created successfully"
            
            # Get the created vehicle data for supplier creation
            vehicle_data = {
                'vehicle_number': data['vehicle_number'],
                'supplier_name': data.get('supplier_name'),
                'material': data.get('material'),
                'inward_no': inward_no,
                'entry_time': data.get('entry_time', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
            }

        conn.commit()
        
        # Auto-create supplier detail if we have the required data
        if vehicle_data and vehicle_data.get('supplier_name') and vehicle_data.get('material') and vehicle_data.get('inward_no'):
            auto_create_supplier_detail(vehicle_data)

        return jsonify({"message": message}), 201

    except Exception as e:
        print(f"Error in create_vehicle: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/vehicles', methods=['GET'])
def get_vehicles():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM vehicles ORDER BY entry_time DESC")
        vehicles = cursor.fetchall()
        return jsonify(vehicles)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/vehicles/<int:vehicle_id>', methods=['PUT'])
def update_vehicle(vehicle_id):
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            UPDATE vehicles 
            SET supplier_name = COALESCE(%s, supplier_name),
                material = COALESCE(%s, material),
                inward_no = COALESCE(%s, inward_no),
                entry_time = %s
            WHERE id = %s
        '''
        values = (
            data.get('supplier_name'),
            data.get('material'),
            data.get('inward_no'),
            data.get('entry_time', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
            vehicle_id
        )
        
        cursor.execute(query, values)
        conn.commit()
        
        return jsonify({"message": "Vehicle updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/vehicles/<int:vehicle_id>', methods=['DELETE'])
def delete_vehicle(vehicle_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM vehicles WHERE id = %s", (vehicle_id,))
        conn.commit()
        return jsonify({"message": "Vehicle deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/vehicles/init-table', methods=['POST'])
def initialize_vehicles_table():
    """
    Route to initialize/recreate the vehicles table with new structure
    """
    try:
        success = create_new_vehicles_table()
        if success:
            return jsonify({"message": "Vehicles table initialized successfully"}), 200
        else:
            return jsonify({"error": "Failed to initialize vehicles table"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Intent Routes
@app.route('/intents', methods=['GET'])
def get_intents():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM intents ORDER BY createdAt DESC")
        intents = cursor.fetchall()
        return jsonify(intents)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/intents', methods=['POST'])
def create_intent():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            INSERT INTO intents (intentNumber, supplier, material, quantity, rate, totalAmount, deliveryDate, narration, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        
        values = (
            data['intentNumber'],
            data['supplier'],
            data['material'],
            float(data['quantity']),
            float(data['rate']),
            float(data['totalAmount']),
            data['deliveryDate'],
            data.get('narration', ''),
            data.get('status', 'Active')
        )
        
        cursor.execute(query, values)
        conn.commit()
        
        return jsonify({"message": "Intent created successfully!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/intents/<int:intent_id>', methods=['PUT'])
def update_intent(intent_id):
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            UPDATE intents SET intentNumber=%s, supplier=%s, material=%s, quantity=%s, rate=%s, 
            totalAmount=%s, deliveryDate=%s, narration=%s, status=%s, updatedAt=%s
            WHERE id=%s
        '''
        
        values = (
            data['intentNumber'],
            data['supplier'],
            data['material'],
            float(data['quantity']),
            float(data['rate']),
            float(data['totalAmount']),
            data['deliveryDate'],
            data.get('narration', ''),
            data.get('status', 'Active'),
            datetime.now(),
            intent_id
        )
        
        cursor.execute(query, values)
        conn.commit()
        
        return jsonify({"message": "Intent updated successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/intents/<int:intent_id>', methods=['DELETE'])
def delete_intent(intent_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM intents WHERE id = %s", (intent_id,))
        conn.commit()
        return jsonify({"message": "Intent deleted successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# GRN Routes
@app.route('/grn', methods=['GET'])
def get_grn():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM grn ORDER BY created_at DESC")
        grns = cursor.fetchall()
        return jsonify(grns)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/grn', methods=['POST'])
def create_grn():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            INSERT INTO grn (grnNumber, poNumber, supplier, material, orderedQty, receivedQty, rate, totalAmount, receivedDate, status, remarks)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        
        values = (
            data['grnNumber'],
            data['poNumber'],
            data['supplier'],
            data['material'],
            float(data['orderedQty']),
            float(data['receivedQty']),
            float(data['rate']),
            float(data['totalAmount']),
            data['receivedDate'],
            data.get('status', 'Received'),
            data.get('remarks', '')
        )
        
        cursor.execute(query, values)
        conn.commit()
        
        return jsonify({"message": "GRN created successfully!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/grn/<int:grn_id>', methods=['PUT'])
def update_grn(grn_id):
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            UPDATE grn SET grnNumber=%s, poNumber=%s, supplier=%s, material=%s, orderedQty=%s, 
            receivedQty=%s, rate=%s, totalAmount=%s, receivedDate=%s, status=%s, remarks=%s, updated_at=%s
            WHERE id=%s
        '''
        
        values = (
            data['grnNumber'],
            data['poNumber'],
            data['supplier'],
            data['material'],
            float(data['orderedQty']),
            float(data['receivedQty']),
            float(data['rate']),
            float(data['totalAmount']),
            data['receivedDate'],
            data.get('status', 'Received'),
            data.get('remarks', ''),
            datetime.now(),
            grn_id
        )
        
        cursor.execute(query, values)
        conn.commit()
        
        return jsonify({"message": "GRN updated successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/grn/<int:grn_id>', methods=['DELETE'])
def delete_grn(grn_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM grn WHERE id = %s", (grn_id,))
        conn.commit()
        return jsonify({"message": "GRN deleted successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# Invoice Payment Details Routes
@app.route('/invoice-payment-details', methods=['GET'])
def get_invoice_payment_details():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM invoice_payment_details ORDER BY created_at DESC")
        details = cursor.fetchall()
        return jsonify(details)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/invoice-payment-details', methods=['POST'])
def create_invoice_payment_details():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            INSERT INTO invoice_payment_details 
            (invoice_number, client_name, material, quantity_ordered, total_amount, received_amount, pending_amount, payment_date, payment_method, remarks)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        
        values = (
            data['invoiceNumber'],
            data['clientName'],
            data['material'],
            float(data['quantityOrdered']),
            float(data['totalAmount']),
            float(data['receivedAmount']),
            float(data['pendingAmount']),
            data.get('paymentDate'),
            data.get('paymentMethod'),
            data.get('remarks', '')
        )
        
        cursor.execute(query, values)
        conn.commit()
        
        return jsonify({"message": "Invoice payment details created successfully!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/invoice-payment-details/<int:payment_id>', methods=['PUT'])
def update_invoice_payment_details(payment_id):
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            UPDATE invoice_payment_details 
            SET invoice_number=%s, client_name=%s, material=%s, quantity_ordered=%s, 
                total_amount=%s, received_amount=%s, pending_amount=%s, payment_date=%s, 
                payment_method=%s, remarks=%s, updated_at=%s
            WHERE id=%s
        '''
        
        values = (
            data['invoiceNumber'],
            data['clientName'],
            data['material'],
            float(data['quantityOrdered']),
            float(data['totalAmount']),
            float(data['receivedAmount']),
            float(data['pendingAmount']),
            data.get('paymentDate'),
            data.get('paymentMethod'),
            data.get('remarks', ''),
            datetime.now(),
            payment_id
        )
        
        cursor.execute(query, values)
        conn.commit()
        
        return jsonify({"message": "Invoice payment details updated successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/invoice-payment-details/<int:payment_id>', methods=['DELETE'])
def delete_invoice_payment_details(payment_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM invoice_payment_details WHERE id = %s", (payment_id,))
        conn.commit()
        return jsonify({"message": "Invoice payment details deleted successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# System Logs Routes
@app.route('/system-logs', methods=['GET'])
def get_system_logs():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get query parameters for filtering
        date_from = request.args.get('dateFrom')
        date_to = request.args.get('dateTo')
        branch = request.args.get('branch')
        module = request.args.get('module')
        action = request.args.get('action')
        user = request.args.get('user')
        
        # Build query with filters
        query = 'SELECT * FROM system_logs WHERE 1=1'
        params = []
        
        if date_from:
            query += ' AND DATE(timestamp) >= %s'
            params.append(date_from)
        
        if date_to:
            query += ' AND DATE(timestamp) <= %s'
            params.append(date_to)
        
        if branch and branch != 'All':
            query += ' AND branch_name = %s'
            params.append(branch)
        
        if module and module != 'All':
            query += ' AND module_name = %s'
            params.append(module)
        
        if action and action != 'All':
            query += ' AND action_performed = %s'
            params.append(action)
        
        if user:
            query += ' AND action_by LIKE %s'
            params.append(f'%{user}%')
        
        query += ' ORDER BY timestamp DESC'
        
        cursor.execute(query, params)
        logs = cursor.fetchall()
        return jsonify(logs)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/system-logs/clear-all', methods=['DELETE'])
def clear_all_logs():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM system_logs")
        conn.commit()
        return jsonify({'message': 'All logs cleared successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/system-logs', methods=['POST'])
def create_system_log():
    try:
        data = request.json
        log_system_activity(
            data.get('branch_name', 'Main Branch'),
            data.get('module_name'),
            data.get('action_performed'),
            data.get('action_by'),
            data.get('action_on'),
            data.get('ip_address', request.remote_addr)
        )
        return jsonify({'message': 'Log created successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def allowed_file(filename):
    """Check if the file extension is allowed."""
    ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/supplier/upload-bill', methods=['POST'])
def upload_bill():
    conn = None
    cursor = None
    file_path = None
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file uploaded', 'message': 'No file provided'}), 400
        
        file = request.files['file']
        vehicle_number = request.form.get('vehicle_number')
        supplier_id = request.form.get('supplier_id')
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected', 'message': 'No file selected'}), 400
        
        if not vehicle_number:
            return jsonify({'success': False, 'error': 'Vehicle number required', 'message': 'Vehicle number required'}), 400
        
        if not supplier_id:
            return jsonify({'success': False, 'error': 'Supplier ID required', 'message': 'Supplier ID required'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'error': 'Invalid file type', 'message': 'Only PDF, JPG, JPEG, PNG allowed'}), 400

        filename = secure_filename(f"{vehicle_number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        print(f"File saved: {file_path}")

        try:
            with open(file_path, 'rb') as f:
                files = {'file': (filename, f, file.content_type)}
                data = {'vehicle_number': vehicle_number}
                
                response = requests.post(
                    f"{EXTRACTOR_SERVICE_URL}/extract-invoice/",
                    files=files,
                    data=data,
                    timeout=60
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"Extractor response: {json.dumps(result, indent=2)}")
                    if result.get('status') == 'success':
                        invoice_data = result.get('data', {})
                        if not invoice_data:
                            return jsonify({
                                'success': False,
                                'error': 'No valid data extracted',
                                'message': 'Failed to extract bill data'
                            }), 400

                        # Extract relevant fields
                        supplier_bill_qty = float(invoice_data.get('qty', 0)) if invoice_data.get('qty') else 0.0
                        supplier_bill_rate = float(invoice_data.get('rate', 0)) if invoice_data.get('rate') else 0.0
                        description = invoice_data.get('description', '')
                        invoice_no = invoice_data.get('invoice_no', '')
                        # invoice_date = invoice_data.get('invoice_date', '')
                        supplier_name = invoice_data.get('supplier', '')
                        gstin = invoice_data.get('gstin', '')
                        address = invoice_data.get('address', '')
                        empty_weight = float(invoice_data.get('empty_weight', 0)) if invoice_data.get('empty_weight') else None
                        load_weight = float(invoice_data.get('load_weight', 0)) if invoice_data.get('load_weight') else None
                        net_weight = float(invoice_data.get('net_weight', 0)) if invoice_data.get('net_weight') else None
                        tax = float(invoice_data.get('tax', 0)) if invoice_data.get('tax') else None
                        cgst = float(invoice_data.get('cgst', 0)) if invoice_data.get('cgst') else None
                        sgst = float(invoice_data.get('sgst', 0)) if invoice_data.get('sgst') else None
                        round_off = float(invoice_data.get('round_off', 0)) if invoice_data.get('round_off') else None
                        total = float(invoice_data.get('total', 0)) if invoice_data.get('total') else None
                        amount_in_words = invoice_data.get('amount_in_words', '')

                        # Update supplier table
                        conn = get_db_connection()
                        cursor = conn.cursor()
                        cursor.execute('''
                            UPDATE supplier 
                            SET supplierBillFile = %s, supplierBillQty = %s, supplierBillRate = %s,
                                description = %s, invoice_number = %s,
                                supplierName = %s, gstin = %s, address = %s, empty_weight = %s,
                                load_weight = %s, net_weight = %s, tax = %s, cgst = %s, sgst = %s,
                                round_off = %s, total = %s, amount_in_words = %s
                            WHERE id = %s
                        ''', (
                            filename, supplier_bill_qty, supplier_bill_rate,
                            description, invoice_no,
                            supplier_name, gstin, address, empty_weight,
                            load_weight, net_weight, tax, cgst, sgst,
                            round_off, total, amount_in_words, supplier_id
                        ))
                        conn.commit()

                        # Insert into invoice_items table
                        cursor.execute('''
                            INSERT INTO invoice_items (vehicle_number, description, quantity, rate, amount,
                                                    supplier_name, invoice_number, gstin, address,
                                                    empty_weight, load_weight, net_weight, tax, cgst, sgst,
                                                    round_off, total, amount_in_words)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ''', (
                            vehicle_number, description, supplier_bill_qty, supplier_bill_rate,
                            (supplier_bill_qty * supplier_bill_rate) if supplier_bill_qty and supplier_bill_rate else None,
                            supplier_name, invoice_no, gstin, address,
                            empty_weight, load_weight, net_weight, tax, cgst, sgst,
                            round_off, total, amount_in_words
                        ))
                        conn.commit()

                        log_system_activity('Main Branch', 'Supplier', 'Upload Bill', 'System', f"Supplier ID {supplier_id}", request.remote_addr)
                        return jsonify({
                            'success': True,
                            'filename': filename,
                            'supplierBillQty': supplier_bill_qty,
                            'supplierBillRate': supplier_bill_rate,
                            'description': description,
                            'invoice_number': invoice_no,
                            # 'invoice_date': invoice_date,
                            'supplier_name': supplier_name,
                            'gstin': gstin,
                            'address': address,
                            'empty_weight': empty_weight,
                            'load_weight': load_weight,
                            'net_weight': net_weight,
                            'tax': tax,
                            'cgst': cgst,
                            'sgst': sgst,
                            'round_off': round_off,
                            'total': total,
                            'amount_in_words': amount_in_words,
                            'message': 'Bill uploaded and processed successfully'
                        })
                    elif result.get('status') == 'db_error':
                        return jsonify({
                            'success': False,
                            'error': result.get('error', 'Extractor database error'),
                            'message': f'Extractor service failed: {result.get("error", "Unknown error")}',
                            'extractorResponse': result
                        }), 500
                    else:
                        return jsonify({
                            'success': False,
                            'error': 'Unexpected extractor response',
                            'message': 'Failed to process bill',
                            'extractorResponse': result
                        }), 500
                print(f"Extractor service error: {response.status_code} {response.text}")
                return jsonify({
                    'success': False,
                    'error': f'Extractor service returned status {response.status_code}',
                    'message': 'Failed to process bill'
                }), response.status_code
                
        except requests.exceptions.RequestException as e:
            print(f"Extractor service unavailable: {e}")
            return jsonify({
                'success': False,
                'error': f'Extractor service unavailable: {str(e)}',
                'message': 'Please ensure extractor service is running on port 8001'
            }), 500
            
    except Exception as e:
        print(f"Error in upload_bill: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to process bill'
        }), 500
    finally:
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"File deleted: {file_path}")
            except Exception as e:
                print(f"Error deleting file: {str(e)}")
        
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()
# Get extracted bill data for vehicle
@app.route('/supplier/bill-data/<vehicle_no>', methods=['GET'])
def get_bill_data(vehicle_no):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT quantity, rate FROM invoice_items 
            WHERE vehicle_number = %s 
            ORDER BY created_at DESC LIMIT 1
        ''', (vehicle_no,))
        
        bill_data = cursor.fetchone()
        
        if bill_data:
            return jsonify({
                'supplierBillQty': float(bill_data['quantity']),
                'supplierBillRate': float(bill_data['rate'])
            })
        else:
            return jsonify({'error': 'No bill data found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# Update supplier with bill data
@app.route('/supplier/<int:supplier_id>/update-bill', methods=['PUT'])
def update_supplier_bill_data(supplier_id):
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Calculate difference
        po_rate_query = 'SELECT poRate FROM supplier WHERE id = %s'
        cursor.execute(po_rate_query, (supplier_id,))
        po_rate_result = cursor.fetchone()
        
        if po_rate_result:
            po_rate = float(po_rate_result[0])
            supplier_bill_rate = float(data.get('supplierBillRate', 0))
            difference = po_rate - supplier_bill_rate
            
            query = '''
                UPDATE supplier 
                SET supplierBillQty = %s, supplierBillRate = %s, difference = %s
                WHERE id = %s
            '''
            values = (
                data.get('supplierBillQty'), 
                data.get('supplierBillRate'), 
                difference,
                supplier_id
            )
            
            cursor.execute(query, values)
            conn.commit()
            
        return jsonify({'message': 'Supplier bill data updated successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# Employee Management Routes
@app.route('/employees', methods=['GET'])
def get_employees():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM employees ORDER BY created_at DESC')
        employees = cursor.fetchall()
        return jsonify(employees)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/employees', methods=['POST'])
def create_employee():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            INSERT INTO employees (full_name, date_of_birth, gender, phone_number, email_id, 
            address, aadhar_number, pan_number, joining_date, designation, department, 
            emergency_contact, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        
        values = (
            data['fullName'], data['dateOfBirth'], data['gender'], data['phoneNumber'],
            data['emailId'], data['address'], data['aadharNumber'], data['panNumber'],
            data['joiningDate'], data['designation'], data['department'],
            data['emergencyContact'], data.get('status', 'Active')
        )
        
        cursor.execute(query, values)
        conn.commit()
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'Employee Management',
            'Add',
            'System',
            f"Employee {data['fullName']}",
            request.remote_addr
        )
        
        return jsonify({'message': 'Employee created successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/employees/<int:employee_id>', methods=['PUT'])
def update_employee(employee_id):
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            UPDATE employees SET full_name=%s, date_of_birth=%s, gender=%s, phone_number=%s,
            email_id=%s, address=%s, aadhar_number=%s, pan_number=%s, joining_date=%s,
            designation=%s, department=%s, emergency_contact=%s, status=%s
            WHERE id=%s
        '''
        
        values = (
            data['fullName'], data['dateOfBirth'], data['gender'], data['phoneNumber'],
            data['emailId'], data['address'], data['aadharNumber'], data['panNumber'],
            data['joiningDate'], data['designation'], data['department'],
            data['emergencyContact'], data.get('status', 'Active'), employee_id
        )
        
        cursor.execute(query, values)
        conn.commit()
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'Employee Management',
            'Update',
            'System',
            f"Employee ID {employee_id}",
            request.remote_addr
        )
        
        return jsonify({'message': 'Employee updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/employees/<int:employee_id>/status', methods=['PATCH'])
def update_employee_status(employee_id):
    try:
        data = request.json
        new_status = data.get("status")

        if not new_status:
            return jsonify({"error": "Status is required"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        query = "UPDATE employees SET status = %s WHERE id = %s"
        cursor.execute(query, (new_status, employee_id))
        conn.commit()

        # Optional logging
        log_system_activity(
            'Main Branch',
            'Employee Management',
            'Update Status',
            'System',
            f"Employee ID {employee_id} status changed to {new_status}",
            request.remote_addr
        )

        return jsonify({"message": "Status updated successfully", "status": new_status})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/employees/<int:employee_id>', methods=['DELETE'])
def delete_employee(employee_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get employee name for logging
        cursor.execute('SELECT full_name FROM employees WHERE id = %s', (employee_id,))
        employee = cursor.fetchone()
        
        cursor.execute('DELETE FROM employees WHERE id = %s', (employee_id,))
        conn.commit()
        
        # Log the activity
        if employee:
            log_system_activity(
                'Main Branch',
                'Employee Management',
                'Delete',
                'System',
                f"Employee {employee['full_name']}",
                request.remote_addr
            )
        
        return jsonify({'message': 'Employee deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# Branch Management Routes
@app.route('/branches', methods=['GET'])
def get_branches():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM branches ORDER BY created_at DESC')
        branches = cursor.fetchall()
        return jsonify(branches)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/branches', methods=['POST'])
def create_branch():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = 'INSERT INTO branches (branch_name, address, contact_number) VALUES (%s, %s, %s)'
        values = (data['branchName'], data['address'], data['contactNumber'])
        
        cursor.execute(query, values)
        conn.commit()
        
        # Log the activity
        log_system_activity(
            data['branchName'],
            'Branch Management',
            'Add',
            'System',
            f"Branch {data['branchName']}",
            request.remote_addr
        )
        
        return jsonify({'message': 'Branch created successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/branches/<int:branch_id>', methods=['PUT'])
def update_branch(branch_id):
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = 'UPDATE branches SET branch_name=%s, address=%s, contact_number=%s WHERE id=%s'
        values = (data['branchName'], data['address'], data['contactNumber'], branch_id)
        
        cursor.execute(query, values)
        conn.commit()
        
        # Log the activity
        log_system_activity(
            data['branchName'],
            'Branch Management',
            'Update',
            'System',
            f"Branch {data['branchName']}",
            request.remote_addr
        )
        
        return jsonify({'message': 'Branch updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/branches/<int:branch_id>', methods=['DELETE'])
def delete_branch(branch_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get branch name for logging
        cursor.execute('SELECT branch_name FROM branches WHERE id = %s', (branch_id,))
        branch = cursor.fetchone()
        
        cursor.execute('DELETE FROM branches WHERE id = %s', (branch_id,))
        conn.commit()
        
        # Log the activity
        if branch:
            log_system_activity(
                branch['branch_name'],
                'Branch Management',
                'Delete',
                'System',
                f"Branch {branch['branch_name']}",
                request.remote_addr
            )
        
        return jsonify({'message': 'Branch deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/roles', methods=['GET'])
def get_roles():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM roles ORDER BY created_at DESC')
        roles = cursor.fetchall()
        return jsonify(roles)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/roles', methods=['POST'])
def create_role():
    try:
        data = request.get_json()
        role_name = data.get('role_name')
        permissions = data.get('permissions')

        if not role_name or permissions is None:
            return jsonify({'error': 'Missing role_name or permissions'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        query = 'INSERT INTO roles (role_name, permissions, created_at) VALUES (%s, %s, %s)'
        values = (role_name, json.dumps(permissions), datetime.now())

        cursor.execute(query, values)
        conn.commit()
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'Role Management',
            'Add',
            'System',
            f"Role {role_name}",
            request.remote_addr
        )
        
        return jsonify({'message': 'Role created successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/roles/<int:role_id>', methods=['PUT'])
def update_role(role_id):
    try:
        data = request.get_json()
        role_name = data.get('role_name')
        permissions = data.get('permissions')

        if not role_name or permissions is None:
            return jsonify({'error': 'Missing role_name or permissions'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        query = 'UPDATE roles SET role_name=%s, permissions=%s WHERE id=%s'
        values = (role_name, json.dumps(permissions), role_id)

        cursor.execute(query, values)
        conn.commit()
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'Role Management',
            'Update',
            'System',
            f"Role {role_name}",
            request.remote_addr
        )
        
        return jsonify({'message': 'Role updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/roles/<int:role_id>', methods=['DELETE'])
def delete_role(role_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get role name for logging
        cursor.execute('SELECT role_name FROM roles WHERE id = %s', (role_id,))
        role = cursor.fetchone()
        
        cursor.execute('DELETE FROM roles WHERE id = %s', (role_id,))
        conn.commit()
        
        # Log the activity
        if role:
            log_system_activity(
                'Main Branch',
                'Role Management',
                'Delete',
                'System',
                f"Role {role['role_name']}",
                request.remote_addr
            )
        
        return jsonify({'message': 'Role deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# Employee Login Routes
@app.route('/employee-login', methods=['GET'])
def get_employee_logins():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = '''
            SELECT el.*, e.full_name as employee_name, b.branch_name, r.role_name
            FROM employee_login el
            LEFT JOIN employees e ON el.employee_id = e.id
            LEFT JOIN branches b ON el.branch_id = b.id
            LEFT JOIN roles r ON el.role_id = r.id
            ORDER BY el.created_at DESC
        '''
        cursor.execute(query)
        logins = cursor.fetchall()
        return jsonify(logins)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/employee-login', methods=['POST'])
def create_employee_login():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            INSERT INTO employee_login (employee_id, branch_id, login_id, password, role_id, status)
            VALUES (%s, %s, %s, %s, %s, %s)
        '''
        values = (
            data['employeeId'], data['branchId'], data['loginId'],
            data['password'], data['roleId'], data.get('status', 'Active')
        )
        
        cursor.execute(query, values)
        conn.commit()
        
        return jsonify({'message': 'Employee login created successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route('/employee-login/<int:login_id>', methods=['DELETE'])
def delete_employee_login(login_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM employee_login WHERE id = %s', (login_id,))
        conn.commit()
        
        return jsonify({'message': 'Employee login deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# GET all projects
@app.route('/projects', methods=['GET'])
def get_projects():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM projects ORDER BY created_at DESC')
        projects = cursor.fetchall()
        return jsonify(projects)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# CREATE new project
@app.route('/projects', methods=['POST'])
def create_project():
    try:
        data = request.get_json(force=True)
        project_name = data.get('project_name')
        address = data.get('address')
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if not project_name or not address or latitude is None or longitude is None:
            return jsonify({'error': 'Missing required fields'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        query = '''
            INSERT INTO projects (project_name, address, latitude, longitude, created_at)
            VALUES (%s, %s, %s, %s, %s)
        '''
        values = (project_name, address, latitude, longitude, datetime.now())

        cursor.execute(query, values)
        conn.commit()
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'Project Management',
            'Add',
            'System',
            f"Project {project_name}",
            request.remote_addr
        )
        
        return jsonify({'message': 'Project created successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# UPDATE project
@app.route('/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    try:
        data = request.get_json(force=True)
        project_name = data.get('project_name')
        address = data.get('address')
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if not project_name or not address or latitude is None or longitude is None:
            return jsonify({'error': 'Missing required fields'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        query = '''
            UPDATE projects
            SET project_name = %s, address = %s, latitude = %s, longitude = %s
            WHERE id = %s
        '''
        values = (project_name, address, latitude, longitude, project_id)

        cursor.execute(query, values)
        conn.commit()
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'Project Management',
            'Update',
            'System',
            f"Project {project_name}",
            request.remote_addr
        )
        
        return jsonify({'message': 'Project updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# DELETE project
@app.route('/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get project name for logging
        cursor.execute('SELECT project_name FROM projects WHERE id = %s', (project_id,))
        project = cursor.fetchone()
        
        cursor.execute('DELETE FROM projects WHERE id = %s', (project_id,))
        conn.commit()
        
        # Log the activity
        if project:
            log_system_activity(
                'Main Branch',
                'Project Management',
                'Delete',
                'System',
                f"Project {project['project_name']}",
                request.remote_addr
            )
        
        return jsonify({'message': 'Project deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# PO Management Routes
@app.route("/po", methods=["GET"])
def get_all_po():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM po_details ORDER BY id DESC")
        result = cursor.fetchall()
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route("/po", methods=["POST"])
def add_po():
    try:
        data = request.json

        required_fields = ["poNumber", "material", "supplier", "quantity", "rate", "totalAmount", "poType", "deliveryDate", "status"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            return jsonify({"error": f"Missing fields: {', '.join(missing_fields)}"}), 400

        # Convert deliveryDate to MySQL-friendly format
        try:
            delivery_date = datetime.strptime(data["deliveryDate"], "%a, %d %b %Y %H:%M:%S %Z").strftime("%Y-%m-%d")
        except ValueError:
            try:
                delivery_date = datetime.strptime(data["deliveryDate"], "%Y-%m-%d").strftime("%Y-%m-%d")
            except ValueError:
                return jsonify({"error": "Invalid date format for deliveryDate"}), 400

        narration = data.get("narration", "")

        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
        INSERT INTO po_details 
        (poNumber, material, supplier, quantity, rate, totalAmount, poType, deliveryDate, narration, status, createdAt, updatedAt)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            data["poNumber"],
            data["material"],
            data["supplier"],
            float(data["quantity"]),
            float(data["rate"]),
            float(data["totalAmount"]),
            data["poType"],
            delivery_date,
            narration,
            data["status"],
            datetime.now(),
            datetime.now()
        )

        cursor.execute(query, values)
        conn.commit()
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'PO Details',
            'Add',
            'System',
            f"PO {data['poNumber']}",
            request.remote_addr
        )
        
        return jsonify({"message": "PO added successfully!"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@app.route("/po/<int:id>", methods=["DELETE"])
def delete_po(id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get PO number for logging
        cursor.execute("SELECT poNumber FROM po_details WHERE id = %s", (id,))
        po = cursor.fetchone()
        
        cursor.execute("DELETE FROM po_details WHERE id = %s", (id,))
        conn.commit()
        
        # Log the activity
        if po:
            log_system_activity(
                'Main Branch',
                'PO Details',
                'Delete',
                'System',
                f"PO {po['poNumber']}",
                request.remote_addr
            )
        
        return jsonify({"message": "PO deleted successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()


@app.route("/po/<int:id>", methods=["PUT"])
def update_po(id):
    try:
        data = request.json

        required_fields = ["poNumber", "material", "supplier", "quantity", "rate", "totalAmount", "poType", "deliveryDate", "status"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            return jsonify({"error": f"Missing fields: {', '.join(missing_fields)}"}), 400

        try:
            delivery_date = datetime.strptime(data["deliveryDate"], "%a, %d %b %Y %H:%M:%S %Z").strftime("%Y-%m-%d")
        except ValueError:
            try:
                delivery_date = datetime.strptime(data["deliveryDate"], "%Y-%m-%d").strftime("%Y-%m-%d")
            except ValueError:
                return jsonify({"error": "Invalid date format for deliveryDate"}), 400

        narration = data.get("narration", "")

        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
        UPDATE po_details SET
            poNumber = %s,
            material = %s,
            supplier = %s,
            quantity = %s,
            rate = %s,
            totalAmount = %s,
            poType = %s,
            deliveryDate = %s,
            narration = %s,
            status = %s,
            updatedAt = %s
        WHERE id = %s
        """
        values = (
            data["poNumber"],
            data["material"],
            data["supplier"],
            float(data["quantity"]),
            float(data["rate"]),
            float(data["totalAmount"]),
            data["poType"],
            delivery_date,
            narration,
            data["status"],
            datetime.now(),
            id
        )

        cursor.execute(query, values)
        conn.commit()
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'PO Details',
            'Update',
            'System',
            f"PO {data['poNumber']}",
            request.remote_addr
        )
        
        return jsonify({"message": "PO updated successfully!"})

    except Exception as e:
        print(f"Update PO error: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()
# Create supplier_payment_details table


# Supplier Routes - UPDATED
@app.route('/supplier', methods=['GET'])
def get_suppliers():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Fetch all supplier data
        cursor.execute("SELECT * FROM supplier ORDER BY created_at DESC")
        suppliers = cursor.fetchall()
        
        formatted_suppliers = []
        
        for supplier in suppliers:
            file_path = supplier['supplierBillFile']
            voucher_no = None
            
            if file_path:
                # Extract the filename from the path
                filename = os.path.basename(file_path)
                
                # Use regex to find a numeric sequence in the filename
                match = re.search(r'\d+', filename)
                if match:
                    voucher_no = match.group(0)
            
            formatted_supplier = {
                'id': supplier['id'],
                'poNumber': supplier['poNumber'],
                'poBalanceQty': float(supplier['poBalanceQty']) if supplier['poBalanceQty'] is not None else None,
                'inwardNo': supplier['inwardNo'],
                'vehicleNo': supplier['vehicleNo'],
                'dateTime': supplier['dateTime'].isoformat() if supplier['dateTime'] else None,
                'supplierName': supplier['supplierName'],
                'material': supplier['material'],
                'uom': supplier['uom'],
                'receivedQty': float(supplier['receivedQty']) if supplier['receivedQty'] is not None else None,
                'receivedBy': supplier['receivedBy'],
                'supplierBillQty': float(supplier['supplierBillQty']) if supplier['supplierBillQty'] is not None else None,
                'poRate': float(supplier['poRate']) if supplier['poRate'] is not None else None,
                'supplierBillRate': float(supplier['supplierBillRate']) if supplier['supplierBillRate'] is not None else None,
                'supplierBillFile': supplier['supplierBillFile'],
                'voucherNo': voucher_no,  # <-- Extracted voucher number
                'difference': float(supplier['difference']) if supplier['difference'] is not None else None,
                'status': supplier['status'],
                'created_at': supplier['created_at'].isoformat() if supplier['created_at'] else None,
                'updated_at': supplier['updated_at'].isoformat() if supplier['updated_at'] else None,
                'orderedQty': float(supplier['orderedQty']) if supplier['orderedQty'] is not None else None
            }
            
            formatted_suppliers.append(formatted_supplier)
        
        # Log the activity
        log_system_activity(
            'Main Branch',
            'Supplier Data',
            'View',
            'System',
            'Fetched supplier data',
            request.remote_addr
        )
        
        return jsonify(formatted_suppliers), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()# Configure upload folder
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)



@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route("/supplier", methods=["POST"])
def add_supplier():
    try:
        # Print incoming request to console
        print(f"Received POST /supplier request from {request.remote_addr}")
        print(f"Form data: {request.form.to_dict()}")
        print(f"Files: {request.files.keys()}")

        # Validate form data
        if not request.form:
            print("Error: No form data provided")
            return jsonify({"error": "Form data is required"}), 400

        data = request.form.to_dict()
        required_fields = [
            "poNumber", "poBalanceQty", "inwardNo", "vehicleNo", "dateTime",
            "supplierName", "material", "poRate", "receivedQty"
        ]
        missing = [f for f in required_fields if not str(data.get(f, '')).strip()]
        if missing:
            print(f"Error: Missing required fields: {', '.join(missing)}")
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        # Validate and convert numeric fields
        try:
            po_balance_qty = float(data["poBalanceQty"])
            po_rate = float(data["poRate"])
            received_qty = float(data["receivedQty"])
            ordered_qty = float(data.get("orderedQty", 0)) if data.get("orderedQty") else None
            # Calculate difference and supplierBillRate
            difference = po_balance_qty * po_rate
            supplier_bill_rate = received_qty * po_rate
            print(f"Calculated: difference = {difference}, supplierBillRate = {supplier_bill_rate}")
        except (ValueError, TypeError) as e:
            print(f"Error: Invalid numeric field: {str(e)}")
            return jsonify({"error": f"Invalid numeric field: {str(e)}"}), 400

        # Handle file upload (optional)
        db_file_path = None
        if 'supplierBillFile' in request.files and request.files['supplierBillFile'].filename:
            file = request.files['supplierBillFile']
            if file.filename == '':
                print("Error: No file selected")
                return jsonify({"error": "No file selected"}), 400

            # Save file to disk
            filename = secure_filename(file.filename)
            base, ext = os.path.splitext(filename)
            counter = 1
            while os.path.exists(os.path.join(app.config['UPLOAD_FOLDER'], filename)):
                filename = f"{base}_{counter}{ext}"
                counter += 1
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            db_file_path = f"uploads/{filename}"
            print(f"Saved file: {file_path}")

        # Check for duplicate inwardNo
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM supplier WHERE inwardNo = %s", 
                      (data["inwardNo"],))
        if cursor.fetchone():
            print(f"Error: Duplicate inwardNo {data['inwardNo']}")
            return jsonify({"error": f"Inward No {data['inwardNo']} already exists"}), 409

        # Insert into database with frontend-provided fields and calculated fields
        query = """
        INSERT INTO supplier
        (poNumber, poBalanceQty, inwardNo, vehicleNo, dateTime, supplierName,
         material, uom, receivedQty, receivedBy, poRate, status, orderedQty,
         supplierBillFile, difference, supplierBillRate)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            data["poNumber"],
            po_balance_qty,
            data["inwardNo"],
            data["vehicleNo"],
            data["dateTime"],
            data["supplierName"],
            data["material"],
            data.get("uom", "CFT"),
            received_qty,
            data.get("receivedBy", None),
            po_rate,
            data.get("status", "Pending"),
            ordered_qty,
            db_file_path,
            difference,
            supplier_bill_rate
        )

        print(f"Executing query: {query % values}")
        cursor.execute(query, values)
        conn.commit()

        # Log the activity
        log_system_activity(
            'Main Branch',
            'Supplier Details',
            'Add',
            'System',
            f"Supplier {data['supplierName']} - Vehicle {data['vehicleNo']} with bill file {filename if db_file_path else 'None'}",
            request.remote_addr
        )

        print("Supplier detail added successfully")
        return jsonify({
            "message": "Supplier detail added successfully!",
            "file_path": db_file_path
        }), 201

    except Exception as e:
        print(f"Error in add_supplier: {str(e)}")
        return jsonify({"error": str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()@app.route("/api/po-details", methods=["GET"])
def get_po_details():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT * FROM po_details WHERE status = 'Active'")
    po_list = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return jsonify(po_list)
@app.route('/supplier-payment-details', methods=['GET'])
def get_supplier_payment_details():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM supplier_payment_details ORDER BY created_at DESC")
    data = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(data)

@app.route('/supplier-payment-details', methods=['POST'])
def create_supplier_payment_detail():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        INSERT INTO supplier_payment_details 
        (po_number, supplier_name, material, quantity_ordered, total_amount, paid_amount, pending_amount, payment_status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    '''
    values = (
        data['poNumber'],
        data['supplierName'],
        data['material'],
        float(data['quantityOrdered']),
        float(data['totalAmount']),
        float(data['paidAmount']),
        float(data['pendingAmount']),
        data['paymentStatus']
    )
    cursor.execute(query, values)
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'message': 'Payment detail added successfully'}), 201

@app.route('/supplier-payment-details/<int:id>', methods=['PUT'])
def update_supplier_payment_detail(id):
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        UPDATE supplier_payment_details 
        SET po_number=%s, supplier_name=%s, material=%s, quantity_ordered=%s,
            total_amount=%s, paid_amount=%s, pending_amount=%s, payment_status=%s
        WHERE id=%s
    '''
    values = (
        data['poNumber'],
        data['supplierName'],
        data['material'],
        float(data['quantityOrdered']),
        float(data['totalAmount']),
        float(data['paidAmount']),
        float(data['pendingAmount']),
        data['paymentStatus'],
        id
    )
    cursor.execute(query, values)
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'message': 'Payment detail updated successfully'})

@app.route('/supplier-payment-details/<int:id>', methods=['DELETE'])
def delete_supplier_payment_detail(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM supplier_payment_details WHERE id = %s', (id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'message': 'Payment detail deleted successfully'})

@app.route("/api/grns", methods=["GET"])
def get_grns():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)  # Important: returns dict instead of tuples

    cursor.execute("SELECT * FROM grn ORDER BY created_at DESC")
    grns = cursor.fetchall()

    # Rename snake_case DB fields to camelCase for frontend
    formatted_grns = []
    for grn in grns:
        formatted_grns.append({
            "id": grn["id"],
            "grnNumber": grn.get("grnNumber") or grn.get("grn_number"),
            "linkedPONumber": grn.get("linked_po_number"),
            "supplierName": grn.get("supplier_name"),
            "project": grn.get("project"),
            "receivedQuantity": str(grn.get("received_quantity", "")),
            "receivedDate": grn.get("received_date").isoformat() if grn.get("received_date") else "",
            "materialCondition": grn.get("material_condition"),
            "supportingDocument": grn.get("supporting_document"),
            "remarks": grn.get("remarks"),
            "createdAt": grn["created_at"].isoformat() if grn.get("created_at") else "",
            "updatedAt": grn["updated_at"].isoformat() if grn.get("updated_at") else ""
        })

    cursor.close()
    conn.close()

    return jsonify(formatted_grns)

@app.route("/api/grns", methods=["POST"])
def add_grn():
    data = request.json

    conn = get_db_connection()
    cursor = conn.cursor()

    sql = '''
        INSERT INTO grn (
            grn_number,
            linked_po_number,
            supplier_name,
            project,
            received_quantity,
            received_date,
            material_condition,
            supporting_document,
            remarks
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    '''

    values = (
        data.get("grnNumber"),
        data.get("linkedPONumber"),
        data.get("supplierName"),
        data.get("project"),
        data.get("receivedQuantity"),
        data.get("receivedDate"),
        data.get("materialCondition"),
        data.get("supportingDocument"),
        data.get("remarks"),
    )

    cursor.execute(sql, values)
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "GRN added successfully"}), 201


@app.route("/supplier/<int:id>", methods=["DELETE"])
def delete_supplier(id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get supplier details for logging
        cursor.execute("SELECT supplierName, vehicleNo FROM supplier WHERE id = %s", (id,))
        supplier = cursor.fetchone()
        
        cursor.execute("DELETE FROM supplier WHERE id = %s", (id,))
        conn.commit()
        
        # Log the activity
        if supplier:
            log_system_activity(
                'Main Branch',
                'Supplier Details',
                'Delete',
                'System',
                f"Supplier {supplier['supplierName']} - Vehicle {supplier['vehicleNo']}",
                request.remote_addr
            )
        
        return jsonify({"message": "Supplier detail deleted!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# Dashboard Statistics Routes
@app.route('/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Total employees
    cursor.execute('SELECT COUNT(*) FROM employees WHERE status = "Active"')
    total_employees = cursor.fetchone()[0]
    
    # Active projects
    cursor.execute('SELECT COUNT(*) FROM projects WHERE status = "Active"')
    active_projects = cursor.fetchone()[0]
    
    # Vehicle entries (today)
    cursor.execute('SELECT COUNT(*) FROM vehicles WHERE DATE(created_at) = CURDATE()')
    vehicle_entries = cursor.fetchone()[0]
    
    # Purchase orders
    cursor.execute('SELECT COUNT(*) FROM po_details WHERE status = "Active"')
    purchase_orders = cursor.fetchone()[0]
    
    cursor.close()
    conn.close()
    
    return jsonify({
        'totalEmployees': total_employees,
        'activeProjects': active_projects,
        'vehicleEntries': vehicle_entries,
        'purchaseOrders': purchase_orders
    })
@app.route('/combined-payment-supplier-details', methods=['GET'])
def get_combined_payment_supplier_details():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Fetch Supplier Payment Details
        cursor.execute("SELECT * FROM supplier_payment_details ORDER BY created_at DESC")
        supplier_payment_details = cursor.fetchall()
        
        # Fetch Invoice Payment Details
        cursor.execute("SELECT * FROM invoice_payment_details ORDER BY created_at DESC")
        invoice_payment_details = cursor.fetchall()
        
        # Fetch Supplier
        cursor.execute("SELECT * FROM supplier ORDER BY created_at DESC")
        supplier_details = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "supplierPaymentDetails": supplier_payment_details,
            "invoicePaymentDetails": invoice_payment_details,
            "suppliers": supplier_details
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Query the user_signin table
        query = '''
            SELECT id, username, password, email, phone_number 
            FROM user_signin 
            WHERE username = %s AND status = 'Active'
        '''
        
        cursor.execute(query, (username,))
        user = cursor.fetchone()
        
        if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            # Update last login (optional, add last_login column to user_signin if needed)
            cursor.execute('UPDATE user_signin SET updated_at = %s WHERE id = %s', 
                         (datetime.now(), user['id']))
            conn.commit()
            
            # Log login activity
            log_system_activity(
                'Main Branch',
                'System',
                'Login',
                username,
                'System Login',
                request.remote_addr
            )
            
            return jsonify({
                'success': True,
                'user': {
                    'id': user['id'],
                    'username': user['username'],
                    'email': user['email'],
                    'phone_number': user['phone_number'],
                    # Add role and other fields if needed
                    'role': 'user',  # Default role, modify as needed
                    'full_name': user['username'],  # Adjust if you add full_name to user_signin
                    'branch_name': 'Main Branch'  # Adjust if you add branch info
                }
            })
        else:
            return jsonify({'error': 'Invalid username or password'}), 401
            
    except Exception as e:
        print(f"Error during login: {str(e)}")
        return jsonify({'error': f'Login error: {str(e)}'}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

# Signup Route
@app.route('/signup', methods=['POST'])
def signup():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        email = data.get('email')
        phone_number = data.get('phone')  # Changed to match frontend payload
        
        # Validate required fields
        if not all([username, password, email]):
            return jsonify({'error': 'Username, password, and email are required'}), 400
        
        # Validate email format
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate phone number format (optional, but if provided, check format)
        if phone_number and not re.match(r'^\+?[\d\s-]{8,15}$', phone_number):
            return jsonify({'error': 'Invalid phone number format'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Check for existing username
        cursor.execute('SELECT id FROM user_signin WHERE username = %s', (username,))
        if cursor.fetchone():
            return jsonify({'error': 'Username already exists'}), 409
        
        # Check for existing email
        cursor.execute('SELECT id FROM user_signin WHERE email = %s', (email,))
        if cursor.fetchone():
            return jsonify({'error': 'Email already exists'}), 409
        
        # Hash the password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Insert new user into user_signin table
        query = '''
            INSERT INTO user_signin (username, password, email, phone_number, status)
            VALUES (%s, %s, %s, %s, %s)
        '''
        values = (username, hashed_password, email, phone_number, 'Active')
        
        cursor.execute(query, values)
        conn.commit()
        
        # Log the signup activity
        log_system_activity(
            'Main Branch',
            'System',
            'Signup',
            username,
            'User Registration',
            request.remote_addr
        )
        
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'user': {
                'username': username,
                'email': email,
                'phone_number': phone_number
            }
        }), 201
        
    except mysql.connector.Error as db_error:
        print(f"Database error during signup: {str(db_error)}")
        return jsonify({'error': f'Database error: {str(db_error)}'}), 500
    except Exception as e:
        print(f"General error during signup: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()    

if __name__ == '__main__':
    init_db()
    app.run(debug=False, use_reloader=False,port=5000)
