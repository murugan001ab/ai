# db_manager.py

import os
import psycopg2

from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()


class DatabaseManager:

    def __init__(self):

        self.db_params = {
            "host": os.getenv("DB_HOST"),
            "database": os.getenv("DB_NAME"),
            "user": os.getenv("DB_USER"),
            "password": os.getenv("DB_PASSWORD"),
            "port": os.getenv("DB_PORT"),
            "sslmode": "require"
        }
        print( os.getenv("DB_HOST"))
        # Store permissions in memory
        self.user_zone_permissions = {}

    # =====================================================
    # CONNECTION
    # =====================================================

    def get_connection(self):
        return psycopg2.connect(**self.db_params)

    # =====================================================
    # INIT DATABASE
    # =====================================================

    def init_db(self):

        try:
            conn = self.get_connection()

            print(f"Database '{self.db_params['database']}' connected.")

            conn.close()

        except Exception as e:
            print(f"Database Init Error: {e}")

    # =====================================================
    # LOAD USER ZONE PERMISSIONS
    # =====================================================

    def load_user_zone_permissions(self):

        try:
            conn = self.get_connection()

            cur = conn.cursor(cursor_factory=RealDictCursor)

            query = """
                SELECT 
                    u.name,
                    array_agg(z.zone_id) AS assigned_zones
                FROM user_zone_permissions z
                INNER JOIN users u
                    ON u.id = z.user_id
                GROUP BY z.user_id, u.name;
            """

            cur.execute(query)

            rows = cur.fetchall()

            permissions = {}

            for row in rows:
                permissions[row["name"]] = row["assigned_zones"]

            self.user_zone_permissions = permissions

            cur.close()
            conn.close()

            print("Zone permissions loaded successfully")

            return self.user_zone_permissions

        except Exception as e:
            print(f"Permission Load Error: {e}")

            self.user_zone_permissions = {}

            return {}

    # =====================================================
    # CHECK ACCESS
    # =====================================================

    def is_zone_allowed(self, person_name, current_zone):

        allowed_zones = self.user_zone_permissions.get(person_name, [])

        return current_zone in allowed_zones


# =========================================================
# CREATE SINGLE GLOBAL INSTANCE
# =========================================================
    def get_cameras(self):

        try:
            conn = self.get_connection()
    
            cur = conn.cursor(cursor_factory=RealDictCursor)
    
            query = """
                SELECT * FROM cameras;
            """
    
            cur.execute(query)
    
            cameras = cur.fetchall()
    
            cur.close()
            conn.close()
            print(cameras)
            return cameras
    
        except Exception as e:
            print(f"Camera Load Error: {e}")
            return []

db_manager = DatabaseManager()