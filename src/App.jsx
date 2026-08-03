import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import EditorWorkspace from './pages/EditorWorkspace';
import QuickToolFlow from './pages/QuickToolFlow';
import './App.css'; // Or keep index.css imported in main.jsx

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor" element={<EditorWorkspace />} />
        <Route path="/tool/:toolId" element={<QuickToolFlow />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
