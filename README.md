# Ultra Smart Shop - Frontend

This is the frontend repository for the Ultra Smart Shop POS system.

## 🚀 GitHub Repository Setup

To push this frontend project to a separate GitHub repository, run these commands in your terminal (inside the `frontend` folder):

```bash
# 1. Initialize git
git init

# 2. Add files
git add .

# 3. Create the first commit
git commit -m "Initial commit - Frontend"

# 4. Link to your GitHub repository (Replace with your actual repo URL)
git remote add origin https://github.com/YOUR-USERNAME/ultra-smart-shop-frontend.git

# 5. Push the code
git branch -M main
git push -u origin main
```

## 🌍 Deployment on Contabo Server

Since the frontend and backend are now in separate repositories, follow these steps to deploy on your server:

1. **SSH into your Contabo VPS:**
   ```bash
   ssh root@YOUR_SERVER_IP
   ```

2. **Navigate to the app directory:**
   ```bash
   cd /opt/ultra-smart-shop
   ```

3. **Clone this Frontend repository:**
   *(If the `frontend` folder already exists, delete it or rename it first `rm -rf frontend`)*
   ```bash
   git clone https://github.com/YOUR-USERNAME/ultra-smart-shop-frontend.git frontend
   ```

4. **Add environment variables:**
   ```bash
   cd frontend
   nano .env.production
   ```
   Add this content:
   ```env
   VITE_API_URL=/api/v1
   ```

5. **Build the project:**
   ```bash
   npm install
   npm run build
   ```

The Nginx configuration already points to `/opt/ultra-smart-shop/frontend/dist`, so the new frontend will be automatically served!

To deploy future updates, just pull the latest code and rebuild:
```bash
cd /opt/ultra-smart-shop/frontend
git pull origin main
npm install
npm run build
```
