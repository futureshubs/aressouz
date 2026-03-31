import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Maximize2, Minimize2 } from 'lucide-react';

interface PanoramaScene {
  id: string;
  title: string;
  imageUrl: string;
  hotSpots?: {
    pitch: number;
    yaw: number;
    type: 'scene' | 'info';
    text?: string;
    sceneId?: string;
  }[];
}

interface PannellumViewerProps {
  scenes: PanoramaScene[];
  initialSceneId?: string;
}

export function PannellumViewer({ scenes, initialSceneId }: PannellumViewerProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const viewerRef = useRef<HTMLDivElement>(null);
  const pannellumInstanceRef = useRef<any>(null);
  const [currentSceneId, setCurrentSceneId] = useState(initialSceneId || scenes[0]?.id);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!viewerRef.current || scenes.length === 0) return;

    // Dynamically import pannellum
    const loadPannellum = async () => {
      try {
        // Load Pannellum CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';
        document.head.appendChild(link);

        // Load Pannellum JS
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';
        script.async = true;
        
        script.onload = () => {
          initializePannellum();
        };

        document.head.appendChild(script);

        return () => {
          document.head.removeChild(link);
          document.head.removeChild(script);
        };
      } catch (error) {
        console.error('Failed to load Pannellum:', error);
        setIsLoading(false);
      }
    };

    loadPannellum();
  }, []);

  const initializePannellum = () => {
    if (!viewerRef.current || !(window as any).pannellum) return;

    const currentScene = scenes.find(s => s.id === currentSceneId) || scenes[0];

    // Build scenes configuration
    const scenesConfig: any = {};
    scenes.forEach(scene => {
      scenesConfig[scene.id] = {
        type: 'equirectangular',
        panorama: scene.imageUrl,
        title: scene.title,
        autoLoad: scene.id === currentScene.id,
        hotSpots: scene.hotSpots?.map(hotspot => ({
          pitch: hotspot.pitch,
          yaw: hotspot.yaw,
          type: hotspot.type === 'scene' ? 'scene' : 'info',
          text: hotspot.text,
          sceneId: hotspot.sceneId,
          createTooltipFunc: hotspot.type === 'info' ? (hotSpotDiv: HTMLElement) => {
            const tooltip = document.createElement('div');
            tooltip.style.cssText = `
              background: ${isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)'};
              color: ${isDark ? '#ffffff' : '#111827'};
              padding: 8px 12px;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 500;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
              pointer-events: none;
            `;
            tooltip.textContent = hotspot.text || '';
            return tooltip;
          } : undefined,
          clickHandlerFunc: hotspot.type === 'scene' && hotspot.sceneId ? () => {
            if (pannellumInstanceRef.current && hotspot.sceneId) {
              pannellumInstanceRef.current.loadScene(hotspot.sceneId);
              setCurrentSceneId(hotspot.sceneId);
            }
          } : undefined,
        })) || [],
      };
    });

    // Initialize Pannellum
    pannellumInstanceRef.current = (window as any).pannellum.viewer(viewerRef.current, {
      default: {
        firstScene: currentScene.id,
        sceneFadeDuration: 1000,
        autoLoad: true,
      },
      scenes: scenesConfig,
    });

    pannellumInstanceRef.current.on('load', () => {
      setIsLoading(false);
    });
  };

  const toggleFullscreen = () => {
    if (!viewerRef.current) return;

    if (!document.fullscreenElement) {
      viewerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleSceneChange = (sceneId: string) => {
    if (pannellumInstanceRef.current) {
      pannellumInstanceRef.current.loadScene(sceneId);
      setCurrentSceneId(sceneId);
    }
  };

  if (scenes.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center rounded-2xl"
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        }}
      >
        <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
          360° ko'rinish mavjud emas
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-3">
      {/* Viewer */}
      <div className="relative flex-1 rounded-2xl overflow-hidden" style={{ minHeight: '400px' }}>
        <div
          ref={viewerRef}
          className="w-full h-full"
          style={{
            background: isDark ? '#0a0a0a' : '#f5f5f5',
          }}
        />

        {/* Loading State */}
        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <div
                className="size-12 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: `${accentColor.color} transparent transparent transparent` }}
              />
              <p className="text-sm font-medium" style={{ color: accentColor.color }}>
                3D ko'rinish yuklanmoqda...
              </p>
            </div>
          </div>
        )}

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 p-3 rounded-xl backdrop-blur-xl transition-all active:scale-90 z-10"
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          {isFullscreen ? (
            <Minimize2 className="size-5 text-white" strokeWidth={2.5} />
          ) : (
            <Maximize2 className="size-5 text-white" strokeWidth={2.5} />
          )}
        </button>

        {/* Current Scene Title */}
        <div
          className="absolute bottom-4 left-4 px-4 py-2 rounded-xl backdrop-blur-xl"
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <p className="text-sm font-bold text-white">
            {scenes.find(s => s.id === currentSceneId)?.title || 'Ko\'rinish'}
          </p>
        </div>
      </div>

      {/* Scene Selector */}
      {scenes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              onClick={() => handleSceneChange(scene.id)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: currentSceneId === scene.id 
                  ? accentColor.color 
                  : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                color: currentSceneId === scene.id 
                  ? '#ffffff' 
                  : (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'),
              }}
            >
              {scene.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
