from youtube_transcript_api import YouTubeTranscriptApi
import json
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from deep_translator import GoogleTranslator
from concurrent.futures import ThreadPoolExecutor
import time

app = Flask(__name__)
CORS(app)

# Thread havuzu oluştur
executor = ThreadPoolExecutor(max_workers=5)

def translate_text(text):
    try:
        # Boş veya çok kısa metinleri çevirme
        if not text or len(text.strip()) < 2:
            return text
            
        print(f"Çevriliyor: {text}")
        translator = GoogleTranslator(source='auto', target='tr')
        result = translator.translate(text)
        print(f"Çeviri sonucu: {result}")
        return result if result else text
    except Exception as e:
        print(f"Çeviri hatası: {str(e)}")
        return text

def get_video_transcript(video_id):
    try:
        print(f"Video ID: {video_id} için altyazılar alınıyor...")
        # Altyazıları al
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        total_items = len(transcript)
        print(f"Toplam {total_items} altyazı bulundu.")
        
        # Zamanları formatlı şekilde kaydet
        formatted_transcript = []
        translation_futures = []
        
        # İlerleme durumunu takip et
        progress = {'current': 0, 'total': total_items}
        
        print("Çeviri işlemleri başlatılıyor...")
        # Çeviri işlemlerini başlat
        for entry in transcript:
            formatted_entry = {
                'start': entry['start'],
                'text': entry['text'],
                'duration': round(entry['duration'], 2)
            }
            formatted_transcript.append(formatted_entry)
            # Çeviri işlemini thread havuzuna ekle
            translation_futures.append(executor.submit(translate_text, entry['text']))
        
        print("Çeviriler bekleniyor...")
        # Çevirileri bekle ve sonuçları ekle
        for i, future in enumerate(translation_futures):
            try:
                translated_text = future.result()
                formatted_transcript[i]['translated_text'] = translated_text
                # İlerlemeyi güncelle
                progress['current'] = i + 1
                print(f"İlerleme: {progress['current']}/{progress['total']}")
                yield f"data: {json.dumps({'progress': progress, 'subtitle': formatted_transcript[i]})}\n\n"
            except Exception as e:
                print(f"Çeviri beklenirken hata: {str(e)}")
                formatted_transcript[i]['translated_text'] = formatted_transcript[i]['text']
                yield f"data: {json.dumps({'progress': progress, 'error': str(e)})}\n\n"
        
        print("Tüm çeviriler tamamlandı!")
        # Tamamlandı mesajı gönder
        yield f"data: {json.dumps({'completed': True, 'subtitles': formatted_transcript})}\n\n"
        
    except Exception as e:
        print(f"Hata oluştu: {str(e)}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

@app.route('/get_subtitles', methods=['GET'])
def get_subtitles():
    video_url = request.args.get('video_url', '')
    if not video_url:
        return jsonify({'error': 'Video URL gerekli'}), 400
    
    try:
        print(f"İstek alındı: {video_url}")
        video_id = video_url.split("watch?v=")[1].split("&")[0]
        print(f"Video ID: {video_id}")
        return Response(
            get_video_transcript(video_id),
            mimetype='text/event-stream'
        )
            
    except Exception as e:
        print(f"Endpoint hatası: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Server başlatılıyor...")
    app.run(port=5000, debug=True)
