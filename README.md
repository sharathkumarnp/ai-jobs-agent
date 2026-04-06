This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Firebase setup

1. Copy env template:

```bash
cp .env.example .env.local
```

2. Fill `NEXT_PUBLIC_FIREBASE_API_KEY` in `.env.local` with your Firebase web API key.
3. Restart `npm run dev`.

Analytics is initialized only in the browser and only when all Firebase config values are present.

### Persisting resumes and workflow data

To save uploads and workflow data into Firebase Storage/Firestore, also add server-side admin credentials in `.env.local`:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (use `\n` escaped newlines)
- `FIREBASE_STORAGE_BUCKET`

With admin configured, this app writes to:

- `users`
- `applications`
- `tasks`
- `tailored_resumes`
- `dispatch`
- `searched`
- `applied`

And uploads baseline resumes to Storage under `resumes/<userId>/...`.

### Enable Firebase Auth

1. In Firebase Console, go to **Authentication** and enable:
   - **Email/Password**
   - **Google** (optional, for SSO button)
2. In Firebase Console, under Authentication settings, add your local domain (e.g. `localhost`) to authorized domains for popup sign-in.
3. Restart `npm run dev`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# ai-jobs-agent
