import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

handlers = """
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPageOrder((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        const currentActiveId = items[pageNumber - 1]?.id;
        const newActiveIndex = newOrder.findIndex(i => i.id === currentActiveId);
        if (newActiveIndex !== -1) {
           setPageNumber(newActiveIndex + 1);
        }
        return newOrder;
      });
    }
  };

  const handleRotatePage = (id) => {
    setPageOrder(items => items.map(p => p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p));
  };

  const handleDuplicatePage = (id) => {
    setPageOrder(items => {
      const idx = items.findIndex(i => i.id === id);
      const pageToDup = items[idx];
      const newPage = { ...pageToDup, id: `page-${pageToDup.originalIndex}-${Date.now()}` };
      const newOrder = [...items];
      newOrder.splice(idx + 1, 0, newPage);
      return newOrder;
    });
  };

  const handleDeletePage = (id) => {
    setPageOrder(items => items.filter(p => p.id !== id));
  };

  const handleInsertBlankPage = () => {
    setPageOrder(items => {
      const newPage = { id: `blank-${Date.now()}`, isBlank: true, rotation: 0 };
      const newOrder = [...items];
      newOrder.splice(pageNumber, 0, newPage);
      return newOrder;
    });
    setPageNumber(pageNumber + 1);
  };
"""

content = content.replace("const handleDownload = async () => {", handlers + "\n  const handleDownload = async () => {")

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
