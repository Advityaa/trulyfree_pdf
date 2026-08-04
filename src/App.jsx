import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import EditorWorkspace from './pages/EditorWorkspace';
import CompareWorkspace from './pages/CompareWorkspace';
import BatchWorkspace from './pages/BatchWorkspace';
import QuickToolFlow from './pages/QuickToolFlow';
import './App.css';
import { Analytics } from '@vercel/analytics/react'; // Or keep index.css imported in main.jsx

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor" element={<EditorWorkspace />} />
        <Route path="/tool/compare" element={<CompareWorkspace />} />
        <Route path="/tool/batch" element={<BatchWorkspace />} />
        <Route path="/tool/:toolId" element={<QuickToolFlow />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
