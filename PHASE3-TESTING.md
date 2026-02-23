# PHASE 3 TESTING INSTRUCTIONS

## ✅ What We Built:
1. Client Intake page with custom URL routing
2. Modified Demo.jsx to save data to Supabase
3. Thank You confirmation page
4. Complete client → database → therapist flow

## 🧪 How to Test (Two Phone Method):

### SETUP: Create a Therapist Account

**Phone 1 (or Mac):**
1. Go to http://localhost:3000/signup
2. Create account:
   - Full Name: Test Therapist
   - Business Name: Test Massage
   - Custom URL: testmassage
   - Phone: 555-111-2222
   - Email: therapist@test.com
   - Password: password123
3. Click "Create Account"
4. **Note your custom URL:** testmassage

---

### TEST 1: Client Intake Flow

**Phone 2 (Client Phone):**
1. Go to: **http://localhost:3000/testmassage**
   *(Replace 'testmassage' with your actual custom URL)*

2. **EXPECTED:** See BodyMap welcome screen with therapist name

3. Fill out client info:
   - Name: John Client
   - Phone: 555-999-8888

4. Click "Start Session"

5. Mark body areas:
   - Front: Tap shoulders (green focus)
   - Back: Tap lower back (green focus)

6. Continue through preferences:
   - Pressure: Medium (3)
   - Goal: Pain Relief
   - Keep other defaults

7. Click "Send to Therapist"

8. **EXPECTED:** Redirected to Thank You page
9. **EXPECTED:** See confirmation message with therapist name

---

### TEST 2: Verify Data in Supabase

**Go to Supabase:**
1. Open your Supabase project
2. Click "Table Editor"

**Check clients table:**
- Should see: John Client, phone 555-999-8888

**Check sessions table:**
- Should see new session with:
  - front_focus: ["f-shoulders"] (or similar)
  - back_focus: ["b-lowerback"] (or similar)
  - pressure: 3
  - goal: "pain"
  - completed: false

---

### TEST 3: Multiple Clients

**Repeat with different client:**
1. Phone 2: Go to http://localhost:3000/testmassage again
2. Use different name: Jane Smith
3. Use different phone: 555-777-6666
4. Mark different body areas
5. Submit

**Verify in Supabase:**
- clients table should have 2 clients
- sessions table should have 2 sessions
- Both linked to same therapist_id

---

### TEST 4: Invalid URL

**Phone 2:**
1. Go to: http://localhost:3000/doesnotexist
2. **EXPECTED:** "Therapist Not Found" error page
3. Click "Go to BodyMap Home"
4. **EXPECTED:** Redirected to homepage

---

### TEST 5: Returning Client

**Phone 2 (same phone as John Client):**
1. Go to http://localhost:3000/testmassage
2. Enter SAME phone number: 555-999-8888
3. Fill out different preferences
4. Submit

**Verify in Supabase:**
- clients table: Still only 1 John Client record
- sessions table: 2 sessions for John Client
- total_sessions should still be 0 (we'll increment in Phase 4)

---

## ✅ Success Criteria:

- [ ] Client can access therapist via custom URL
- [ ] BodyMap intake works on mobile
- [ ] Data saves to Supabase correctly
- [ ] Thank you page shows after submission
- [ ] Invalid URLs show error page
- [ ] Existing clients don't create duplicates
- [ ] All sessions linked to correct therapist

---

## 🐛 Common Issues:

**"Therapist not found"**
→ Make sure you're using the correct custom URL
→ Check therapists table has your account with that URL

**Intake doesn't save**
→ Check browser console for errors
→ Verify .env file has correct Supabase credentials
→ Check Row Level Security policies allow public inserts

**Thank you page is blank**
→ State may not be passing correctly
→ Try refreshing - it's just a confirmation page

**Can't access from phone**
→ Make sure phone is on same WiFi network
→ Use your computer's local IP instead of localhost
→ Example: http://192.168.1.100:3000/testmassage

---

## 📱 Testing on Actual Phone:

**Find your Mac's local IP:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On Phone (same WiFi):**
- Go to: http://YOUR_IP_ADDRESS:3000/testmassage
- Example: http://192.168.1.100:3000/testmassage

---

## 📊 PHASE 3 STATUS:

Once all tests pass, Phase 3 is 100% complete!

**What works:**
- ✅ Custom URL routing (mybodymap.app/yourname pattern)
- ✅ Client intake saves to database
- ✅ Body map selections stored
- ✅ Preferences saved
- ✅ Thank you confirmation
- ✅ Client deduplication by phone

**Next: Phase 4 (Therapist Dashboard)**
- View all client sessions
- See body map visualizations
- Add therapist notes
- Mark sessions complete
