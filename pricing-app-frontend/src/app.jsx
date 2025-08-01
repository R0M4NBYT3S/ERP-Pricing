import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DynamicForm from './components/DynamicForm.jsx';
import Admin from './components/Admin.jsx'; // ✅ Use proper case for consistency

function App() {
  return (
    <Router>
      <Routes>
        {/* Home Page - Pricing Form */}
        <Route
          path="/"
          element={
            <main className="min-h-screen p-4 bg-gray-100 flex justify-center items-center">
              <DynamicForm />
            </main>
          }
        />

        {/* Admin Page */}
        <Route
          path="/admin"
          element={
            <main className="min-h-screen p-4 bg-gray-100 flex justify-center items-center">
              <Admin />
            </main>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
