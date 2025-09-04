import React, { useEffect, useState } from 'react';
import Login from './Login.jsx';

export default function PrivateRoute({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const j = await res.json();
        setUser(j.user || null);
      } catch {
        setUser(null);
      }
    })();
  }, []);

  if (user === undefined) {
    return <div className="p-8 text-center">Loading…</div>;
  }
  if (!user) {
    return <Login onSuccess={() => window.location.reload()} />;
  }
  return children;
}
