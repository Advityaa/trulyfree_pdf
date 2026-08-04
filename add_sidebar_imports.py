import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

imports = """
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, Trash, FilePlus2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
"""

content = content.replace("import { usePinch } from '@use-gesture/react';", "import { usePinch } from '@use-gesture/react';\n" + imports)
content = content.replace("setPageOrder(initialOrder);", "setPageOrder(initialOrder);\n        setPageNumber(1);")

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
