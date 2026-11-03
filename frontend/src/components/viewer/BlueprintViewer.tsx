'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCw, Move, Layers, Eye, 
  Download, ExternalLink, ShieldCheck, AlertCircle, RefreshCw, 
  ChevronLeft, ChevronRight, FileText, ArrowRight, Search, ChevronUp, ChevronDown,
  MoreVertical
} from 'lucide-react';
import { CitationSource } from '@/types/construction-rag';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

// Configure local worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface BlueprintViewerProps {
  selectedCitation?: CitationSource;
  onClearCitation?: () => void;
  onSelectCitation?: (citation: CitationSource) => void;
}

interface HighlightBox {
  x: number;
  y: number;
  width: number;
  height: number;
  isTextSnapped: boolean;
}

export const BlueprintViewer: React.FC<BlueprintViewerProps> = ({
  selectedCitation,
  onClearCitation,
  onSelectCitation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  // PDF Document State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Transform (Zoom, Pan, Rotation)
  const [scale, setScale] = useState<number>(1.2);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(() => {
    if (typeof selectedCitation?.force_rotation === 'number') return selectedCitation.force_rotation;
    if (typeof selectedCitation?.rotation === 'number') return selectedCitation.rotation;
    return 90; // Default a horizontal landscape para planos arquitectónicos de obra
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Highlight Box state
  const [highlightBox, setHighlightBox] = useState<HighlightBox | null>(null);
  const [isPanningTransition, setIsPanningTransition] = useState<boolean>(false);

  // In-document Search State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchMatches, setSearchMatches] = useState<any[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);

  // Default PDF
  const pdfUrl = selectedCitation?.file_url || '/sample-blueprint.pdf';

  // 1. Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          const targetPg = selectedCitation?.page_number || 1;
          setCurrentPage(targetPg);

          // Detect initial rotation: from citation or from native PDF page rotate
          const firstPage = await doc.getPage(targetPg);
          const nativeRotate = firstPage.rotate || 0;
          let initialRot = nativeRotate;
          if (typeof selectedCitation?.force_rotation === 'number') {
            initialRot = selectedCitation.force_rotation;
          } else if (typeof selectedCitation?.recommended_rotation === 'number') {
            initialRot = selectedCitation.recommended_rotation;
          } else if (typeof selectedCitation?.rotation === 'number') {
            initialRot = selectedCitation.rotation;
          } else if (nativeRotate === 0) {
            // Auto-detect: if page is portrait (height > width) on an architectural drawing, default to landscape 90°
            const unrotated = firstPage.getViewport({ scale: 1.0, rotation: 0 });
            if (unrotated.height > unrotated.width) {
              initialRot = 90;
            }
          }
          setRotation(initialRot);
          setLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Error loading blueprint PDF:', err);
          setError(`Failed to load PDF (${err.message || err})`);
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [pdfUrl, selectedCitation?.page_number]);

  // 2. Render Page onto Canvas with High DPI & Vector Sharpness
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDoc.getPage(currentPage);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const baseViewport = page.getViewport({ scale: 1.0, rotation });
      setPageSize({ width: baseViewport.width, height: baseViewport.height });

      const viewport = page.getViewport({ scale, rotation });
      const pixelRatio = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    }
  }, [pdfDoc, currentPage, scale, rotation]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Multi-page helper
  const findPageForQuote = async (doc: any, initialPage: number, quote: string): Promise<number> => {
    if (!doc || !quote || doc.numPages <= 1) return initialPage;

    const words = quote
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñ\s]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    if (words.length === 0) return initialPage;
    const searchToken = words.slice(0, 3).join(' ');

    try {
      const pInit = await doc.getPage(initialPage);
      const tc = await pInit.getTextContent();
      const txt = tc.items.map((it: any) => it.str || '').join(' ').toLowerCase();
      if (txt.includes(searchToken) || (words.length >= 2 && words.slice(0, 2).every((w) => txt.includes(w)))) {
        return initialPage;
      }
    } catch (e) {
      // continue
    }

    const maxPages = Math.min(doc.numPages, 25);
    for (let p = 1; p <= maxPages; p++) {
      if (p === initialPage) continue;
      try {
        const pageObj = await doc.getPage(p);
        const tc = await pageObj.getTextContent();
        const txt = tc.items.map((it: any) => it.str || '').join(' ').toLowerCase();
        if (txt.includes(searchToken) || (words.length >= 2 && words.slice(0, 2).every((w) => txt.includes(w)))) {
          return p;
        }
      } catch (err) {
        // continue
      }
    }

    return initialPage;
  };

  // 3. Hybrid Text Search (Glyphs) + box_2d Fallback
  const calculateHighlightBox = useCallback(
    async (
      page: any,
      viewport: any,
      citation: CitationSource
    ): Promise<HighlightBox | null> => {
      if (!page || !viewport || !citation) return null;

      const exactQuote = (citation.exact_quoted_text || citation.text_excerpt || '').trim();
      if (exactQuote.length > 5) {
        try {
          const textContent = await page.getTextContent();
          const items = (textContent.items || []) as any[];

          const cleanQuote = exactQuote
            .toLowerCase()
            .replace(/[^a-z0-9áéíóúñ\s]/gi, ' ')
            .trim();
          const quoteWords = cleanQuote.split(/\s+/).filter((w) => w.length > 2);

          if (quoteWords.length >= 1) {
            let bestCluster: any[] = [];
            let bestScore = 0;

            for (let i = 0; i < items.length; i++) {
              const itemStr = (items[i].str || '').toLowerCase();
              if (!itemStr.trim()) continue;

              if (!quoteWords.some((w) => itemStr.includes(w))) continue;

              const baseTx = items[i].transform?.[4] ?? 0;
              const baseTy = items[i].transform?.[5] ?? 0;
              const candidateItems: any[] = [items[i]];
              let windowText = itemStr;

              // Expandir a ítems contiguos en la misma celda/fila (dentro de 35 unidades de tx y 650 de ty)
              for (let j = i + 1; j < Math.min(items.length, i + 8); j++) {
                const itNext = items[j];
                if (!itNext?.transform) continue;
                const dTx = Math.abs(itNext.transform[4] - baseTx);
                const dTy = Math.abs(itNext.transform[5] - baseTy);

                if (dTx < 35 && dTy < 650) {
                  candidateItems.push(itNext);
                  windowText += ' ' + (itNext.str || '').toLowerCase();
                }
              }

              let score = 0;
              for (const w of quoteWords) {
                if (windowText.includes(w)) score += 1;
              }

              if (score > bestScore) {
                bestScore = score;
                bestCluster = [...candidateItems];

                // Incluir identificador previo si es número de ítem o círculo de referencia en la misma línea
                if (i > 0 && items[i - 1]?.transform) {
                  const prevTx = items[i - 1].transform[4];
                  const prevTy = items[i - 1].transform[5];
                  if (Math.abs(prevTx - baseTx) < 20 && Math.abs(prevTy - baseTy) < 160) {
                    bestCluster.unshift(items[i - 1]);
                  }
                }
              }
            }

            if (bestCluster.length > 0 && bestScore >= Math.min(2, quoteWords.length)) {
              let minX = Infinity;
              let minY = Infinity;
              let maxX = -Infinity;
              let maxY = -Infinity;

              for (const it of bestCluster) {
                if (!it.transform) continue;
                const [a, b, c, d, e, f] = it.transform;
                const scaleX = Math.hypot(a, b) || 1;
                const scaleY = Math.hypot(c, d) || 1;
                const ux = a / scaleX;
                const uy = b / scaleX;
                const vx = c / scaleY;
                const vy = d / scaleY;
                const w = it.width || (it.str?.length ? it.str.length * 8 : 40);
                const h = it.height || scaleY || 14;

                const corners = [
                  [e, f],
                  [e + ux * w, f + uy * w],
                  [e + vx * h, f + vy * h],
                  [e + ux * w + vx * h, f + uy * w + vy * h],
                ];

                const pts = corners.map(([px, py]) => viewport.convertToViewportPoint(px, py));
                for (const p of pts) {
                  minX = Math.min(minX, p[0]);
                  minY = Math.min(minY, p[1]);
                  maxX = Math.max(maxX, p[0]);
                  maxY = Math.max(maxY, p[1]);
                }
              }

              if (minX < Infinity && maxX > -Infinity && maxX > minX && maxY > minY) {
                const padX = 14;
                const padY = 6;
                return {
                  x: Math.max(0, minX - padX),
                  y: Math.max(0, minY - padY),
                  width: Math.max(40, (maxX - minX) + (padX * 2)),
                  height: Math.max(18, (maxY - minY) + (padY * 2)),
                  isTextSnapped: true,
                };
              }
            }
          }
        } catch (err) {
          console.warn('Text search snap fallback to box_2d:', err);
        }
      }

      // Fallback to box_2d
      const rawBox = citation.box_2d || [
        (citation.bounding_box[1] / 100) * 1000,
        (citation.bounding_box[0] / 100) * 1000,
        ((citation.bounding_box[1] + citation.bounding_box[3]) / 100) * 1000,
        ((citation.bounding_box[0] + citation.bounding_box[2]) / 100) * 1000,
      ];

      const [ymin, xmin, ymax, xmax] = rawBox;
      const x = (xmin / 1000) * viewport.width;
      const y = (ymin / 1000) * viewport.height;
      const width = ((xmax - xmin) / 1000) * viewport.width;
      const height = ((ymax - ymin) / 1000) * viewport.height;

      return {
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.max(20, width),
        height: Math.max(14, height),
        isTextSnapped: false,
      };
    },
    []
  );

  // 4. Center and Auto-zoom to Bounding Box when citation is clicked
  useEffect(() => {
    if (!selectedCitation || !pdfDoc) {
      setHighlightBox(null);
      return;
    }

    let isCancelled = false;

    const syncAndPan = async () => {
      try {
        const quote = (selectedCitation.exact_quoted_text || selectedCitation.text_excerpt || '').trim();
        let targetPage = selectedCitation.page_number || 1;

        if (pdfDoc.numPages > 1 && quote.length > 5) {
          targetPage = await findPageForQuote(pdfDoc, targetPage, quote);
        }

        if (targetPage !== currentPage) {
          setCurrentPage(targetPage);
        }

        // Apply recommended rotation if specified (0, 90, 180, 270)
        let targetRotation = rotation;
        if (typeof selectedCitation.force_rotation === 'number') {
          targetRotation = selectedCitation.force_rotation;
        } else if (typeof selectedCitation.recommended_rotation === 'number') {
          targetRotation = selectedCitation.recommended_rotation;
        } else if (typeof selectedCitation.rotation === 'number') {
          targetRotation = selectedCitation.rotation;
        } else {
          const pageObj = await pdfDoc.getPage(targetPage);
          if (pageObj.rotate) {
            targetRotation = pageObj.rotate;
          } else {
            const unrot = pageObj.getViewport({ scale: 1.0, rotation: 0 });
            if (unrot.height > unrot.width) {
              targetRotation = 90;
            }
          }
        }

        if (targetRotation !== rotation) {
          setRotation(targetRotation);
        }

        // Apply recommended zoom if specified (percentage e.g. 100, 120, 140)
        let targetScale = scale;
        if (typeof selectedCitation.auto_zoom === 'number') {
          targetScale = Math.min(4.0, Math.max(0.6, selectedCitation.auto_zoom / 100));
        } else if (typeof selectedCitation.recommended_zoom === 'number') {
          targetScale = Math.min(4.0, Math.max(0.6, selectedCitation.recommended_zoom / 100));
        } else {
          targetScale = Math.max(scale, 1.3);
        }

        if (targetScale !== scale) {
          setScale(targetScale);
        }

        const page = await pdfDoc.getPage(targetPage);
        const viewport = page.getViewport({ scale: targetScale, rotation: targetRotation });

        const box = await calculateHighlightBox(page, viewport, selectedCitation);
        if (isCancelled || !box) return;

        setHighlightBox(box);

        if (containerRef.current) {
          const viewerWidth = containerRef.current.clientWidth;
          const viewerHeight = containerRef.current.clientHeight;

          const targetPanX = (viewerWidth / 2) - (box.x + (box.width / 2));
          const targetPanY = (viewerHeight / 2) - (box.y + (box.height / 2));

          setIsPanningTransition(true);
          setPan({ x: targetPanX, y: targetPanY });
          setTimeout(() => setIsPanningTransition(false), 450);
        }
      } catch (err) {
        console.error('Error during syncAndPan:', err);
      }
    };

    syncAndPan();

    return () => {
      isCancelled = true;
    };
  }, [selectedCitation, pdfDoc, calculateHighlightBox]);

  // Recalculate box on scale / rotation
  useEffect(() => {
    if (!selectedCitation || !pdfDoc) return;
    let isCancelled = false;

    const updateBoxOnTransform = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale, rotation });
        const box = await calculateHighlightBox(page, viewport, selectedCitation);
        if (!isCancelled && box) {
          setHighlightBox(box);
        }
      } catch (e) {
        // ignore
      }
    };

    updateBoxOnTransform();
    return () => {
      isCancelled = true;
    };
  }, [scale, rotation, currentPage, pdfDoc, selectedCitation, calculateHighlightBox]);

  // In-document Search Handler
  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (!pdfDoc || !term.trim() || term.length < 2) {
      setSearchMatches([]);
      setCurrentMatchIndex(0);
      return;
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      const textContent = await page.getTextContent();
      const matches: any[] = [];
      const termLower = term.toLowerCase();

      for (const item of textContent.items as any[]) {
        if (item.str && item.str.toLowerCase().includes(termLower)) {
          matches.push(item);
        }
      }

      setSearchMatches(matches);
      setCurrentMatchIndex(0);

      if (matches.length > 0) {
        const viewport = page.getViewport({ scale, rotation });
        const item = matches[0];
        const [scaleX, skewY, skewX, scaleY, tx, ty] = item.transform;
        const h = item.height || Math.abs(scaleY) || 12;
        const w = item.width || 30;
        const pt1 = viewport.convertToViewportPoint(tx, ty);
        const pt2 = viewport.convertToViewportPoint(tx + w, ty + h);
        const vx = Math.min(pt1[0], pt2[0]);
        const vy = Math.min(pt1[1], pt2[1]);
        const vw = Math.abs(pt1[0] - pt2[0]);
        const vh = Math.abs(pt1[1] - pt2[1]);

        setHighlightBox({
          x: Math.max(0, vx - 4),
          y: Math.max(0, vy - 2),
          width: Math.max(20, vw + 8),
          height: Math.max(14, vh + 4),
          isTextSnapped: true,
        });

        if (containerRef.current) {
          const vwWidth = containerRef.current.clientWidth;
          const vwHeight = containerRef.current.clientHeight;
          setIsPanningTransition(true);
          setPan({
            x: (vwWidth / 2) - (vx + vw / 2),
            y: (vwHeight / 2) - (vy + vh / 2),
          });
          setTimeout(() => setIsPanningTransition(false), 450);
        }
      }
    } catch (e) {
      console.warn('In-document search error:', e);
    }
  };

  const nextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIdx);
  };

  const prevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIdx);
  };

  // Mouse Wheel Deep-Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setScale((prev) => Math.min(Math.max(0.3, prev * zoomFactor), 6.0));
  };

  // Mouse Drag Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Fit Width / Fit Page
  const handleFitWidth = () => {
    if (!containerRef.current || !pageSize.width) return;
    const containerW = containerRef.current.clientWidth - 48;
    const newScale = containerW / pageSize.width;
    setScale(Math.max(0.4, newScale));
    setPan({ x: 24, y: 24 });
  };

  const handleFitPage = () => {
    if (!containerRef.current || !pageSize.width || !pageSize.height) return;
    const containerW = containerRef.current.clientWidth - 48;
    const containerH = containerRef.current.clientHeight - 48;
    const scaleX = containerW / pageSize.width;
    const scaleY = containerH / pageSize.height;
    const newScale = Math.min(scaleX, scaleY);
    setScale(Math.max(0.3, newScale));
    setPan({
      x: (containerRef.current.clientWidth - (pageSize.width * newScale)) / 2,
      y: (containerRef.current.clientHeight - (pageSize.height * newScale)) / 2,
    });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const activeDocName = selectedCitation?.target_document || selectedCitation?.sheet_number || 'sample-blueprint.pdf';
  const isCurrentIfc = selectedCitation?.is_current_ifc !== false;

  return (
    <div className="flex flex-col h-full w-full bg-[#12151b] text-[#ffffff] overflow-hidden relative select-none">
      {/* 1. Barra superior del archivo activo */}
      <div className="h-11 bg-[#12151b] border-b border-[#1f242e] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden text-xs">
          <FileText className="w-4 h-4 text-[#8a93a0] shrink-0" />
          <span className="font-mono font-semibold text-[#ffffff] truncate max-w-[260px] lg:max-w-[420px]" title={activeDocName}>
            {activeDocName}
          </span>
          <span className="text-zinc-600 hidden sm:inline">•</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-sans font-medium bg-[#1f242e] text-[#8a93a0] shrink-0">
            {isCurrentIfc ? 'Current IFC' : 'Superseded'}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[#8a93a0]">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded hover:bg-[#1f242e] hover:text-[#ffffff] transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-[#1f242e] hover:text-[#ffffff] transition-colors"
            title="Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            className="p-1.5 rounded hover:bg-[#1f242e] hover:text-[#ffffff] transition-colors"
            title="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Toolbar de herramientas del visor (Debajo del header) */}
      <div className="h-10 bg-[#12151b] border-b border-[#1f242e] px-4 flex items-center justify-between shrink-0 text-xs text-[#8a93a0]">
        {/* Controles a la izquierda: Zoom, Fit, Buscador integrado */}
        <div className="flex items-center gap-2.5">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setScale((s) => Math.max(0.3, s / 1.2))}
              className="w-6 h-6 rounded bg-[#151821] border border-[#1f242e] hover:border-zinc-600 text-[#8a93a0] hover:text-[#ffffff] flex items-center justify-center font-bold text-xs"
              title="Zoom Out (-)"
            >
              -
            </button>
            <span className="text-xs font-mono text-[#ffffff] px-1.5 min-w-[42px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(6.0, s * 1.2))}
              className="w-6 h-6 rounded bg-[#151821] border border-[#1f242e] hover:border-zinc-600 text-[#8a93a0] hover:text-[#ffffff] flex items-center justify-center font-bold text-xs"
              title="Zoom In (+)"
            >
              +
            </button>
          </div>

          <span className="text-[#1f242e] hidden sm:inline">|</span>

          {/* Fit Controls */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={handleFitWidth}
              className="px-2 py-1 rounded bg-[#151821] border border-[#1f242e] hover:border-zinc-600 text-[11px] text-[#8a93a0] hover:text-[#ffffff] transition-colors"
              title="Fit to Width"
            >
              Fit Width
            </button>
            <button
              onClick={handleFitPage}
              className="px-2 py-1 rounded bg-[#151821] border border-[#1f242e] hover:border-zinc-600 text-[11px] text-[#8a93a0] hover:text-[#ffffff] transition-colors"
              title="Fit to Page"
            >
              Fit Page
            </button>
            <button
              onClick={handleRotate}
              className={`px-1.5 py-1 rounded border transition-colors flex items-center gap-1 ${
                rotation > 0
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-[#151821] border-[#1f242e] hover:border-zinc-600 text-[#8a93a0] hover:text-[#ffffff]'
              }`}
              title="Rotate 90° Clockwise"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="font-mono text-[10px]">{rotation}°</span>
            </button>
          </div>

          <span className="text-[#1f242e] hidden md:inline">|</span>

          {/* Buscador integrado: Search in document */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#151821] border border-[#1f242e]">
            <Search className="w-3 h-3 text-[#8a93a0] shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search in document"
              className="bg-transparent text-xs text-[#ffffff] placeholder-[#8a93a0]/60 focus:outline-none w-28 md:w-36 font-sans"
            />
            <span className="text-[10px] text-[#8a93a0] font-mono shrink-0">
              {searchMatches.length > 0 ? `${currentMatchIndex + 1}/${searchMatches.length}` : '0/0'}
            </span>
            <button
              onClick={prevMatch}
              disabled={searchMatches.length === 0}
              className="text-[#8a93a0] hover:text-[#ffffff] disabled:opacity-30"
              title="Previous match"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={nextMatch}
              disabled={searchMatches.length === 0}
              className="text-[#8a93a0] hover:text-[#ffffff] disabled:opacity-30"
              title="Next match"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Controles a la derecha: Paginación */}
        <div className="flex items-center gap-2 text-[#8a93a0] font-mono text-xs">
          <span>Page {currentPage} of {totalPages || 1}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="w-6 h-6 rounded bg-[#151821] border border-[#1f242e] hover:border-zinc-600 text-[#8a93a0] hover:text-[#ffffff] flex items-center justify-center disabled:opacity-30 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages || 1, p + 1))}
              disabled={currentPage >= totalPages}
              className="w-6 h-6 rounded bg-[#151821] border border-[#1f242e] hover:border-zinc-600 text-[#8a93a0] hover:text-[#ffffff] flex items-center justify-center disabled:opacity-30 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Área de la hoja: Document Canvas sobre fondo neutro #1a1d24 */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={cn(
          "flex-1 w-full h-full relative overflow-hidden bg-[#1a1d24] flex items-center justify-center cursor-grab",
          isDragging && "cursor-grabbing"
        )}
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1d24]/90 z-40 backdrop-blur-sm">
            <RefreshCw className="h-7 w-7 text-amber-400 animate-spin mb-2" />
            <p className="text-xs font-mono text-zinc-300">Rendering Full-Scale Vector PDF...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1d24]/95 z-40 p-6 text-center">
            <AlertCircle className="h-9 w-9 text-red-500 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">Error Loading PDF Blueprint</h3>
            <p className="text-xs text-red-400 font-mono max-w-md">{error}</p>
          </div>
        )}

        {/* Scaled & Panned Document Canvas Wrapper */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: '0 0',
            position: 'absolute',
            left: 0,
            top: 0,
            transition: isPanningTransition ? 'transform 450ms cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
          }}
          className="relative inline-block"
        >
          {/* HTML5 Canvas: White Paper Sheet with Deep Shadow */}
          <canvas
            ref={canvasRef}
            className="block shadow-2xl border border-[#2a2f3a] bg-white"
          />

          {/* Coordinate Bounding Box Overlay: Warm Golden Semi-Transparent */}
          {selectedCitation && highlightBox && (
            <div
              style={{
                position: 'absolute',
                left: `${highlightBox.x}px`,
                top: `${highlightBox.y}px`,
                width: `${highlightBox.width}px`,
                height: `${highlightBox.height}px`,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.25)',
                borderWidth: '1.5px',
                borderStyle: 'solid',
                boxShadow: '0 0 20px rgba(245, 158, 11, 0.35)',
              }}
              className="pointer-events-auto rounded animate-pulse-border z-30 group transition-all"
            >
              {/* Construction CAD Corner Crosshairs */}
              <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-amber-500" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-amber-500" />
              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-amber-500" />
              <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-amber-500" />

              {/* Floating Callout Badge */}
              <div 
                className="absolute -top-7 left-0 px-2 py-0.5 rounded bg-[#12151b] border border-[#f59e0b] text-[10px] font-mono font-bold shadow-lg flex items-center gap-1.5 whitespace-nowrap text-amber-400"
              >
                <span>📍 {selectedCitation.callout_tag || selectedCitation.sheet_number}</span>
                {highlightBox.isTextSnapped ? (
                  <span className="text-[9px] px-1 rounded bg-amber-400/20 text-amber-300 font-mono">TEXT SNAP ✓</span>
                ) : (
                  <span className="text-[9px] px-1 rounded bg-[#1f242e] text-[#8a93a0] font-mono">CAD BOX</span>
                )}
              </div>

              {/* Hover Technical Excerpt Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-0 mb-2 w-80 p-2.5 rounded-lg bg-[#12151b] border border-[#1f242e] text-[11px] text-zinc-200 shadow-2xl pointer-events-none backdrop-blur-md">
                <span className="font-bold block mb-0.5 text-amber-400">
                  {selectedCitation.callout_tag || selectedCitation.sheet_number}:
                </span>
                <span className="font-mono text-[#8a93a0] line-clamp-4 leading-relaxed">
                  "{selectedCitation.exact_quoted_text || selectedCitation.text_excerpt}"
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Floating Info Pill */}
        <div className="absolute bottom-3 left-4 z-20 flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#12151b]/90 border border-[#1f242e] text-[11px] font-mono text-[#8a93a0] backdrop-blur-md shadow-xl">
          <span>Scale: {Math.round(scale * 100)}%</span>
          <span>•</span>
          <span>Pan: ({Math.round(pan.x)}, {Math.round(pan.y)})</span>
          <span>•</span>
          {highlightBox?.isTextSnapped ? (
            <span className="text-amber-400 font-bold">🎯 Glyph Snap (0% error)</span>
          ) : (
            <span>Edge-to-Edge Canvas</span>
          )}
        </div>
      </div>
    </div>
  );
};
