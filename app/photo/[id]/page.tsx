'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { isImageId } from '@/lib/imageId';
import { getFile } from '@/lib/fileStorage';

export default function PhotoPage() {
  const params = useParams();
  const id = params.id as string;

  const [imageData, setImageData] = useState<{
    src: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadImage() {
      // Проверка валидности ID
      if (!isImageId(id)) {
        setError('Неверный формат ID изображения');
        setLoading(false);
        return;
      }

      try {
        // Попытка загрузить из IndexedDB
        const file = await getFile(id);
        
        if (!file) {
          setError('Изображение не найдено');
          setLoading(false);
          return;
        }

        if (!file.mimeType.startsWith('image/')) {
          setError('Файл не является изображением');
          setLoading(false);
          return;
        }

        // Формируем data URL
        const src = `data:${file.mimeType};base64,${file.data}`;
        
        setImageData({
          src,
          name: file.name
        });
        setLoading(false);
      } catch (err) {
        console.error('Error loading image:', err);
        setError('Ошибка загрузки изображения');
        setLoading(false);
      }
    }

    loadImage();
  }, [id]);

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: '#fff', textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '2px solid #fff',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error || !imageData) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: '60px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Ошибка</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>{error || 'Изображение не найдено'}</p>
        </div>
      </div>
    );
  }

  // Просто показываем картинку на весь экран
  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        body {
          margin: 0;
          overflow: hidden;
        }
      `}</style>
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <img 
          src={imageData.src} 
          alt={imageData.name}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain'
          }}
        />
      </div>
    </>
  );
}
