# nlite

⚡ _"Like Next.js, if it was built in a garage with duct tape and React 19 hype"_

### **What is this**

`nlite` is my attempt to create a React 19 framework that cobbles together **React Server Components (RSC)**, **SSR streaming**, and **static generation (SSG)**, **Partial prerendering** ..etc using the latest unstable APIs.

Think of it as **Next.js’s rebellious younger sibling**—fewer features, more `console.log` statements.

### **Goal**

To **learn React 19 and NextJS features** by rebuilding core Next.js features from scratch,

- RSC and Client Components handling
- Streaming SSR with Suspense and Error Boundaries
- Static generation
- Partial pre rendering
- Routing using config files.

---

**Warning**: This is **not production-ready**. It’s a **toy project** that might:

- Crash if you look at it wrong
- Redefine "undefined behavior"
- Accidentally summon a Cthulhu of `use()` promises

**But hey—it’s fun to hack on!** 🔧

---

### **Quick Start**

```bash
git clone git@github.com:shamilkotta/nlite.git
cd nlite
pnpm install
pnpm nlite build
pnpm example start
# pray to the React gods
```
