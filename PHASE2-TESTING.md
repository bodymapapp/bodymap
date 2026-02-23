# PHASE 2 TESTING INSTRUCTIONS

## ✅ What We Built:
1. Supabase database connection
2. Authentication system (signup/login/logout)
3. Protected routes (dashboard requires login)
4. Complete signup/login UI

## 🧪 How to Test:

### Step 1: Install Dependencies
```bash
cd ~/Downloads/bodymap-website-v2  # Or wherever your project is
npm install
```

### Step 2: Add .env File
Make sure your `.env` file is in the project root with:
```
REACT_APP_SUPABASE_URL=https://rmnqfrljoknmellbnpiy.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_actual_anon_key_here
REACT_APP_BASE_URL=http://localhost:3000
```

### Step 3: Start the App
```bash
npm start
```

### Step 4: Test Signup Flow
1. Go to http://localhost:3000/signup
2. Fill out the form:
   - Full Name: Your Name
   - Business Name: Test Massage
   - Custom URL: testmassage (auto-fills from business name)
   - Phone: 555-123-4567
   - Email: test@example.com
   - Password: password123
   - Confirm Password: password123
3. Click "Create Account"
4. **EXPECTED:** You should be redirected to /dashboard
5. **EXPECTED:** You should see "Dashboard Coming Soon!" message

### Step 5: Verify in Supabase
1. Go to your Supabase project
2. Click "Table Editor"
3. Click "therapists" table
4. **EXPECTED:** You should see your new therapist record with:
   - email: test@example.com
   - business_name: Test Massage
   - custom_url: testmassage
   - plan: free

### Step 6: Test Logout (Manual for now)
1. Open browser console (F12)
2. Type: `window.location.href = '/login'`
3. You should be on login page

### Step 7: Test Login Flow
1. Go to http://localhost:3000/login
2. Enter:
   - Email: test@example.com
   - Password: password123
3. Click "Sign In"
4. **EXPECTED:** Redirected to /dashboard

### Step 8: Test Protected Routes
1. Log out (close browser or clear cookies)
2. Try to go directly to http://localhost:3000/dashboard
3. **EXPECTED:** Automatically redirected to /login

## ✅ Success Criteria:
- [ ] Signup creates account and logs you in
- [ ] Data appears in Supabase therapists table
- [ ] Login works with created account
- [ ] Dashboard is protected (requires login)
- [ ] Redirect to login when not authenticated

## 🐛 Common Issues:

**"Cannot find module '@supabase/supabase-js'"**
→ Run: `npm install @supabase/supabase-js`

**"Invalid login credentials"**
→ Make sure email/password match what you signed up with

**Blank screen / errors in console**
→ Check that .env file has correct Supabase credentials

**"User already registered"**
→ Use a different email or check Supabase auth users

## 📊 PHASE 2 STATUS: 
Once all tests pass, Phase 2 is 100% complete!

Next: Phase 3 (Client Intake Integration)
