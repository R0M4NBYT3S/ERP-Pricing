import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DynamicForm from './components/DynamicForm.jsx';
import AnnouncementBar from './components/AnnouncementBar.jsx';
import Admin from './components/Admin.jsx';
import JobKanban from './components/JobKanban.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';

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
            <main className="min-h-screen p-4 bg-gray-100">
              <Admin />
            </main>
          }
        />
        <Route
          path="/jobs"
          element={
            <PrivateRoute>
              <main className="min-h-screen p-4 bg-gray-100">
                <JobKanban />
              </main>
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
