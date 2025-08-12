import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DynamicForm from './components/DynamicForm.jsx';
import Admin from './components/Admin.jsx';
import AnnouncementBar from './components/AnnouncementBar.jsx';

function App() {
  return (
    <Router>
      <AnnouncementBar />
      <Routes>
        <Route
          path="/"
          element={
            <main className="min-h-screen p-4 bg-gray-100 flex justify-center items-center">
              <DynamicForm />
            </main>
          }
        />
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
