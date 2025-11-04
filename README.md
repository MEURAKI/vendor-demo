# Meuraki Vendor Portal - Setup Guide

## Prerequisites
- Node.js 18.x or higher
- npm or yarn package manager
- Git

## Step 1: Create Project Directory
```bash
# Create and navigate to project directory
mkdir meuraki-vendor-portal
cd meuraki-vendor-portal
```

## Step 2: Initialize Next.js Project
```bash
# Option 1: Create Next.js app with TypeScript
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"

# When prompted, select:
# ✔ Would you like to use ESLint? … Yes
# ✔ Would you like to use Tailwind CSS? … Yes
# ✔ Would you like to use `src/` directory? … Yes
# ✔ Would you like to use App Router? … Yes
# ✔ Would you like to customize the default import alias? … No
```

## Step 3: Install All Dependencies
```bash
# Install core dependencies
npm install axios @hookform/resolvers react-hook-form date-fns react-hot-toast zustand @tanstack/react-query lucide-react recharts tailwind-merge zod clsx

# Install dev dependencies
npm install -D @tailwindcss/forms @tailwindcss/typography prettier prettier-plugin-tailwindcss
```

## Step 4: Create Folder Structure
```bash
# Run the batch file (Windows) or shell script (Mac/Linux) you downloaded earlier
# OR manually create the structure:

# Create main directories
mkdir -p src/app/api/auth/{login,logout,register,refresh}
mkdir -p src/app/api/vendor/{profile,settings,[vendorId]}
mkdir -p src/app/api/products/{[productId],bulk}
mkdir -p src/app/api/orders/[orderId]
mkdir -p src/app/api/dashboard/{stats,analytics}

mkdir -p src/app/pages/auth/{login,register,forgot-password}
mkdir -p src/app/pages/dashboard/{products,orders,analytics,settings}

mkdir -p src/sections/auth
mkdir -p src/sections/dashboard/{overview,products,orders,settings}

mkdir -p src/components/{ui,layout,common}
mkdir -p src/{lib,hooks,types}
mkdir -p src/styles/components
mkdir -p public/{images,icons}
```

## Step 5: Configure TypeScript
Create/update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## Step 6: Configure Next.js
Create/update `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', 'your-cdn-domain.com'],
  },
}

module.exports = nextConfig
```

## Step 7: Setup Environment Variables
Create `.env.local`:
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Google OAuth (if using)
GOOGLE_CLIENT_ID=114282803305-i55d990v04sm86a723q0p1sl69imokdi
GOOGLE_CLIENT_SECRET=REDACTED_GOOGLE_CLIENT_SECRET

# Database (if using Prisma)
DATABASE_URL="postgresql://user:password@localhost:5432/meuraki_vendor"
```

## Step 8: Configure Prettier
Create `.prettierrc`:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

## Step 9: Configure ESLint
Create/update `.eslintrc.json`:
```json
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "react/prop-types": "off",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

## Step 10: Add the UI Components
1. Copy the downloaded components to their respective folders:
   - `login-form.tsx` → `src/sections/auth/`
   - `signup-form.tsx` → `src/sections/auth/`
   - `auth-layout.tsx` → `src/components/layout/`
   - `globals.css` → `src/styles/`
   - `tailwind.config.js` → root directory

## Step 11: Setup Additional Utilities

### Create API Client (`src/lib/api-client.ts`):
```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;
```

### Create Auth Hook (`src/hooks/useAuth.ts`):
```typescript
import { create } from 'zustand';

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: async (email, password) => {
    // Implement login logic
    set({ isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, isAuthenticated: false });
  },
}));
```

## Step 12: Run the Project
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

## Additional Optional Packages

### For Forms and Validation:
```bash
npm install yup @hookform/resolvers
```

### For State Management:
```bash
npm install @reduxjs/toolkit react-redux
```

### For UI Components:
```bash
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs
```

### For Authentication:
```bash
npm install next-auth @auth/prisma-adapter
```

### For Database:
```bash
npm install prisma @prisma/client
npx prisma init
```

### For Testing:
```bash
npm install -D @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom
```

## Troubleshooting

### Common Issues:
1. **Module not found errors**: Make sure all paths in imports use the `@/` alias
2. **TypeScript errors**: Run `npm run type-check` to identify issues
3. **Tailwind not working**: Ensure `tailwind.config.js` content paths are correct
4. **Environment variables not loading**: Restart the dev server after changing `.env.local`

## Next Steps:
1. Set up authentication flow
2. Create dashboard components
3. Implement API routes
4. Set up database (if needed)
5. Add state management
6. Configure deployment

## Useful Commands:
```bash
# Format all files
npm run format

# Check for TypeScript errors
npm run type-check

# Lint code
npm run lint

# Clean install
rm -rf node_modules package-lock.json
npm install
```