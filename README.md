# OceanFresh — Complete File Structure

```
fishshop/
│
├── index.html                  ← Storefront (customer-facing)
├── styles.css                  ← Storefront styles
├── app.js                      ← Storefront logic
├── data.js                     ← Product data + WhatsApp number (edit here!)
│
└── admin/
    ├── index.html              ← Admin panel entry point
    │
    ├── css/
    │   └── admin.css           ← Admin panel styles
    │
    └── js/
        ├── store.js            ← Data layer (localStorage CRUD + analytics)
        └── admin.js            ← Admin panel logic (auth, dashboard, products, orders)
```

# OceanFresh Backend

This is the Node.js/Express backend for OceanFresh, using SQLite for data storage.

> [!IMPORTANT]
> This project is built using **Node.js + Express + SQLite**. It does **NOT** use Firebase.

## Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run Diagnostics (Optional):**
    ```bash
    node check_setup.js
    ```
    This will verify your database and show you the current admin credentials.

3.  **Start the Server:**
    ```bash
    node server.js
    ```
    The backend will run on [http://localhost:3000](http://localhost:3000).

4.  **Access the Admin Panel:**
    Navigate to [http://localhost:3000/admin](http://localhost:3000/admin) in your browser.

## Default Admin Credentials
-   **Mobile:** `9083093198`
-   **Password:** `admin123`

---

## 🔐 Admin Login

URL: `admin/index.html`

| Field    | Default Value  |
|----------|----------------|
| Mobile   | `9876543210`   |
| Password | `admin123`     |

---

## 📋 Feature Overview

### Auth
- Login with mobile number + password
- Forgot password → OTP verification → reset password
- Change password from Settings panel
- Change mobile number from Settings panel
- Session persists in localStorage

### Dashboard
- Today's sales count + income
- This week's income
- Pending orders count
- Total orders + total revenue (all time)
- 7-day bar chart (toggle: Income / Sales)
- Top 5 selling products this month
- Recent 5 orders table

### Products
- View all products with emoji, name, category, price
- Toggle Available / Unavailable (live toggle switch)
- Toggle Featured / Not Featured
- Add new product (name, subtitle, price, emoji, category)
- Edit any product
- Delete product (with confirmation)
- Filter by category
- Search by name / subtitle

### Orders
- View all orders (from demo data + real WhatsApp orders)
- Filter by status: All / Pending / Preparing / Delivered
- Search by customer name, order ID, phone
- Click any order → full detail modal
- Update order status (Pending → Preparing → Delivered)

### Settings
- Change your name
- Change mobile number (used as login ID)
- Change password (requires current password)
- WhatsApp number instructions
- Sign out

---

## ⚙️ How to Update Products in Storefront

The storefront (`index.html`) reads from `data.js`.  
The admin panel reads/writes to **localStorage**.

> ⚠️ Currently these are two separate stores. To sync them:
> In production, replace `localStorage` in `store.js` with API calls
> that write to a database, and have `data.js` fetch from the same database.

For a simple no-backend setup, after editing products in the admin panel,
export the updated product list and paste it into `data.js` manually.

---

## 🚀 To Go Live

1. Replace `WHATSAPP_NUMBER` in `data.js` with real shop number
2. For OTP: integrate an SMS API (e.g. MSG91, Fast2SMS) in `store.js → generateOTP()`
3. For real persistence: replace `localStorage` with a backend API (Node.js / Firebase / Supabase)
4. Host on any static server (Netlify, Vercel, GitHub Pages)