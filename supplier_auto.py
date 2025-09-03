import mysql.connector
from datetime import datetime

def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="your_username",
        password="your_password",
        database="construction"
    )

def auto_create_supplier_detail(vehicle_data):
    print("Creating supplier detail...")
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Insert vehicle data if not exists
        cursor.execute('''
            INSERT IGNORE INTO vehicles (inward_no, vehicle_number, supplier_name, material, entry_time)
            VALUES (%s, %s, %s, %s, %s)
        ''', (
            vehicle_data.get('inward_no'),
            vehicle_data.get('vehicle_number'),
            vehicle_data.get('supplier_name'),
            vehicle_data.get('material'),
            vehicle_data.get('entry_time', datetime.now())
        ))
        conn.commit()

        # Get PO data based on supplier and material
        cursor.execute('''
            SELECT po_number, supplier_name, material, quantity_ordered, rate,
                   (quantity_ordered - COALESCE((SELECT SUM(received_qty) 
                                                 FROM supplier_details 
                                                 WHERE po_number = PurchaseOrder.po_number 
                                                 AND received_qty IS NOT NULL), 0)) AS balance_qty
            FROM PurchaseOrder
            WHERE supplier_name = %s AND material = %s AND status = 'Active'
            ORDER BY created_at DESC LIMIT 1
        ''', (vehicle_data['supplier_name'], vehicle_data['material']))
        po_data = cursor.fetchone()

        if not po_data:
            print(f"No PO found for supplier: {vehicle_data['supplier_name']}, material: {vehicle_data['material']}")
            supplier_detail = {
                'po_number': 'AUTO-' + vehicle_data.get('inward_no', 'TEMP'),
                'po_balance_qty': 0,
                'inward_no': vehicle_data['inward_no'],
                'vehicle_no': vehicle_data['vehicle_number'],
                'date_time': vehicle_data['entry_time'],
                'supplier_name': vehicle_data['supplier_name'],
                'material': vehicle_data['material'],
                'received_qty': 0,
                'received_by': 'System Auto',
                'supplier_bill_rate': 0,
                'status': 'Pending'
            }
        else:
            supplier_detail = {
                'po_number': po_data['po_number'],
                'po_balance_qty': float(po_data['balance_qty']) if po_data['balance_qty'] else float(po_data['quantity_ordered']),
                'inward_no': vehicle_data['inward_no'],
                'vehicle_no': vehicle_data['vehicle_number'],
                'date_time': vehicle_data['entry_time'],
                'supplier_name': vehicle_data['supplier_name'],
                'material': vehicle_data['material'],
                'received_qty': 1,
                'received_by': 'System Auto',
                'supplier_bill_rate': float(po_data['rate']) if po_data['rate'] else 0,
                'status': 'Pending'
            }

        # Check if supplier detail already exists for this vehicle, inward_no, and po_number
        cursor.execute('''
            SELECT id FROM supplier_details 
            WHERE vehicle_no = %s AND inward_no = %s AND po_number = %s
        ''', (vehicle_data['vehicle_number'], vehicle_data['inward_no'], supplier_detail['po_number']))
        existing = cursor.fetchone()

        if existing:
            print(f"Supplier detail already exists for vehicle: {vehicle_data['vehicle_number']}, PO: {supplier_detail['po_number']}")
            cursor.close()
            conn.close()
            return

        # Insert into supplier_details
        query = '''
            INSERT INTO supplier_details 
            (po_number, po_balance_qty, inward_no, vehicle_no, date_time,
             supplier_name, material, received_qty, received_by, supplier_bill_rate, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''

        values = (
            supplier_detail['po_number'], supplier_detail['po_balance_qty'],
            supplier_detail['inward_no'], supplier_detail['vehicle_no'],
            supplier_detail['date_time'], supplier_detail['supplier_name'],
            supplier_detail['material'], supplier_detail['received_qty'],
            supplier_detail['received_by'], supplier_detail['supplier_bill_rate'],
            supplier_detail['status']
        )

        cursor.execute(query, values)
        conn.commit()

        print(f"Auto-created supplier detail for vehicle: {vehicle_data['vehicle_number']}, PO: {supplier_detail['po_number']}")

    except mysql.connector.Error as e:
        print(f"Error auto-creating supplier detail: {str(e)}")
        if conn and conn.is_connected():
            conn.rollback()
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

if __name__ == "__main__":
    vehicle_data = {
        'inward_no': 'INV123',
        'vehicle_number': 'KA01AB1234',
        'supplier_name': 'ABC Suppliers',
        'material': 'Cement',
        'entry_time': datetime.now()
    }
    auto_create_supplier_detail(vehicle_data)