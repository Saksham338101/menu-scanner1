# 🍽️ Restaurant System - Complete Guide

## Overview

The restaurant system is now **fully functional** with complete CRUD operations, menu management, and QR code generation. Restaurant owners can manage their establishments and menus, while customers can browse and view nutrition information.

## Features Implemented

### ✅ Public Features
- **Restaurant Directory** (`/restaurants`)
  - Browse all restaurants
  - Search by name, cuisine type, or description
  - View restaurant details and menus
  - See nutrition information for menu items
  - Responsive design with beautiful UI

### ✅ Owner Features
- **Restaurant Management** (`/my-restaurants`)
  - Create new restaurants
  - Edit restaurant details
  - Delete restaurants
  - Manage menus for each restaurant
  - Generate QR codes for menus
  
### ✅ Menu Management
- Add menu items with full nutrition data
- Edit existing menu items
- Delete menu items
- Display calories, protein, carbs, fat
- Set prices and allergen information

### ✅ QR Code System
- Generate unique QR codes for each restaurant
- QR codes link to public menu view
- Download or display QR codes
- Perfect for physical menus and marketing

## Database Schema

Already applied in Supabase:

```sql
-- Restaurants table
restaurants:
  - id (uuid, primary key)
  - owner_user_id (uuid, references auth.users)
  - name (text)
  - description (text)
  - address (text)
  - cuisine_type (text)
  - phone (text)
  - image_url (text)
  - slug (text, unique)
  - created_at, updated_at

-- Menu Items table
menu_items:
  - id (uuid, primary key)
  - restaurant_id (uuid, references restaurants)
  - name (text)
  - description (text)
  - price (numeric)
  - calories (integer)
  - protein (numeric)
  - carbs (numeric)
  - fat (numeric)
  - allergens (text)
  - created_at, updated_at
```

## API Endpoints

### Restaurants API (`/api/restaurants`)

**GET** - List all restaurants
```javascript
fetch('/api/restaurants')
// Returns: { restaurants: [...] }
```

**GET** - Get restaurant by slug
```javascript
fetch('/api/restaurants?slug=healthy-cafe')
// Returns: { restaurant: {...} }
```

**POST** - Create restaurant (auth required)
```javascript
fetch('/api/restaurants', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer TOKEN'
  },
  body: JSON.stringify({
    name: 'Healthy Cafe',
    description: 'Fresh and nutritious meals',
    cuisine_type: 'Healthy',
    address: '123 Main St',
    phone: '555-1234',
    image_url: 'https://...'
  })
})
```

**PUT** - Update restaurant (owner only)
```javascript
fetch('/api/restaurants', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer TOKEN'
  },
  body: JSON.stringify({
    id: 'restaurant-uuid',
    name: 'Updated Name',
    // ... other fields
  })
})
```

**DELETE** - Delete restaurant (owner only)
```javascript
fetch('/api/restaurants?id=restaurant-uuid', {
  method: 'DELETE',
  headers: { 'Authorization': 'Bearer TOKEN' }
})
```

### Menu API (`/api/menu`)

**GET** - Get menu items for restaurant
```javascript
fetch('/api/menu?restaurant_id=restaurant-uuid')
// Returns: { items: [...] }
```

**POST** - Create menu item (owner only)
```javascript
fetch('/api/menu', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer TOKEN'
  },
  body: JSON.stringify({
    restaurant_id: 'restaurant-uuid',
    name: 'Grilled Salmon',
    description: 'Fresh Atlantic salmon',
    price: 18.99,
    calories: 450,
    protein: 35,
    carbs: 12,
    fat: 28,
    allergens: 'fish'
  })
})
```

**PUT** - Update menu item (owner only)
```javascript
fetch('/api/menu', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer TOKEN'
  },
  body: JSON.stringify({
    id: 'item-uuid',
    name: 'Updated Name',
    price: 19.99,
    // ... other fields
  })
})
```

**DELETE** - Delete menu item (owner only)
```javascript
fetch('/api/menu?id=item-uuid', {
  method: 'DELETE',
  headers: { 'Authorization': 'Bearer TOKEN' }
})
```

## Usage Guide

### For Restaurant Owners

#### 1. Create Your First Restaurant

1. **Sign in** to your account
2. Navigate to **"My Restaurants"** from the header
3. Click **"+ Add Restaurant"**
4. Fill in the form:
   - Restaurant Name (required)
   - Description
   - Cuisine Type (e.g., Italian, Japanese)
   - Address
   - Phone
   - Image URL
5. Click **"Create Restaurant"**

#### 2. Add Menu Items

1. From **My Restaurants**, click **"Manage Menu"** on your restaurant card
2. Click **"+ Add Menu Item"**
3. Fill in the menu item details:
   - Item Name (required)
   - Description
   - Price
   - Nutrition info (calories, protein, carbs, fat)
   - Allergens
4. Click **"Add Item"**

#### 3. Generate QR Code

1. From **My Restaurants**, click **"QR Code"** on your restaurant card
2. The QR code appears with a link to your public menu
3. **Download** or **print** the QR code
4. Place it on physical menus, flyers, or your restaurant entrance

#### 4. Edit & Manage

- **Edit Restaurant**: Click "Edit" on restaurant card
- **Edit Menu Item**: In menu view, click "Edit" next to any item
- **Delete**: Click "Delete" (confirmation required)

### For Customers

#### Browse Restaurants

1. Go to **"Restaurants"** from the header
2. Browse all available restaurants
3. Use the **search bar** to find specific cuisines or names
4. Click on any restaurant card to view its menu

#### View Menu & Nutrition

1. Click **"View Menu"** on a restaurant
2. See all menu items with:
   - Dish name and description
   - Price
   - Calories
   - Macros (protein, carbs, fat)
3. Make informed dietary choices!

#### Scan QR Code

1. Use your phone camera to scan restaurant QR code
2. Opens directly to that restaurant's menu
3. Perfect for in-restaurant browsing

## File Structure

```
src/
├── pages/
│   ├── restaurants.js          # Public restaurant directory
│   ├── my-restaurants.js       # Owner dashboard
│   └── api/
│       ├── restaurants.js      # Restaurant CRUD API
│       └── menu.js             # Menu CRUD API
├── components/
│   ├── header.js               # Updated with restaurant links
│   └── QrImage.js              # QR code display component
└── utils/
    └── qr.js                   # QR URL builder utility
```

## Security & Permissions

### Row Level Security (RLS)

**Restaurants Table**:
- ✅ Anyone can **read** (public directory)
- ✅ Authenticated users can **create** (owner_user_id set automatically)
- ✅ Only **owner** can update/delete their restaurants

**Menu Items Table**:
- ✅ Anyone can **read** (public menus)
- ✅ Only restaurant **owner** can create/update/delete menu items
- ✅ RLS enforces `is_restaurant_owner()` helper function

### Authentication

All owner operations require:
1. Valid Supabase session
2. Bearer token in Authorization header
3. RLS policies automatically enforce ownership

## UI Components

### Restaurant Card
```jsx
- Image (if provided)
- Name
- Cuisine type badge
- Description
- Address
- Action buttons (View Menu, Edit, Delete, QR)
```

### Menu Item Display
```jsx
- Name (bold)
- Description
- Price (green, prominent)
- Calories (orange badge)
- Macros (color-coded: protein=blue, carbs=green, fat=purple)
- Action buttons (Edit, Delete for owners)
```

### Modals
- **Restaurant Form**: Create/edit restaurant details
- **Menu Form**: Create/edit menu items
- **Menu Viewer**: Browse restaurant menu (public)
- **QR Display**: Show and download QR code

## Responsive Design

✅ **Desktop**: Full grid layout, side-by-side modals
✅ **Tablet**: 2-column grid, adjusted modals
✅ **Mobile**: Single column, mobile-friendly forms

## Color Scheme

- **Primary**: Orange-Yellow gradient (`from-orange-500 to-yellow-500`)
- **Accent**: Blue-Purple for menu management
- **Nutrition**: 
  - Calories: Orange (`text-orange-600`)
  - Protein: Blue (`text-blue-600`)
  - Carbs: Green (`text-green-600`)
  - Fat: Purple (`text-purple-600`)

## Testing Checklist

### Owner Flow
- [ ] Create restaurant
- [ ] Edit restaurant details
- [ ] Delete restaurant (with confirmation)
- [ ] Add menu items
- [ ] Edit menu items
- [ ] Delete menu items
- [ ] Generate QR code
- [ ] View public menu from QR URL

### Customer Flow
- [ ] Browse restaurant directory
- [ ] Search restaurants
- [ ] View restaurant menu
- [ ] See nutrition information
- [ ] Click through multiple restaurants

### Security
- [ ] Non-owners cannot edit/delete others' restaurants
- [ ] Non-authenticated users cannot create restaurants
- [ ] RLS enforces ownership on menu items
- [ ] Public users can view all restaurants and menus

## Next Steps (Optional Enhancements)

### 1. Restaurant Reviews
```sql
-- Already exists in schema!
restaurant_reviews:
  - Add review form in public restaurant view
  - Display average rating
  - Filter by rating
```

### 2. AI Menu Assessment
```sql
-- Already exists in schema!
menu_item_ai_assessments:
  - Analyze menu items for user's health profile
  - Provide personalized recommendations
  - Highlight allergens and dietary restrictions
```

### 3. Advanced Features
- Image upload for restaurants/menu items
- Multi-image galleries
- Operating hours
- Online ordering integration
- Reservations
- Loyalty programs

## Troubleshooting

### "Unauthorized" errors
- Check if user is signed in
- Verify Supabase session is valid
- Check browser console for token

### RLS "permission denied"
- Verify user owns the restaurant
- Check that `owner_user_id` matches `auth.uid()`
- Review Supabase policy logs

### QR code not loading
- Check if data prop is provided to `<QrImage>`
- Verify URL is properly encoded
- Check external API is accessible

## Quick Links

- **Public Directory**: http://localhost:3000/restaurants
- **Owner Dashboard**: http://localhost:3000/my-restaurants
- **Main App**: http://localhost:3000

---

## 🎉 Restaurant System is Live!

Your complete restaurant management system is now fully functional with:
- ✅ Public restaurant directory
- ✅ Owner dashboard with CRUD operations
- ✅ Menu management
- ✅ QR code generation
- ✅ Nutrition display
- ✅ Responsive design
- ✅ Secure RLS policies

Start by visiting **/restaurants** to see the public directory, or **/my-restaurants** to manage your own restaurants!
