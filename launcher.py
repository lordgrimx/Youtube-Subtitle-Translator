import os
import sys
import subprocess
import webbrowser
import json
from threading import Thread
import time

def run_backend():
    try:
        from get_subtitles import app
        app.run(port=5000)
    except Exception as e:
        print(f"Backend başlatılırken hata: {str(e)}")

def install_extension():
    # Chrome'u extension yükleme sayfasıyla aç
    extension_path = os.path.abspath(os.path.dirname(__file__))
    webbrowser.open('chrome://extensions/')
    
    print("\nYouTube Subtitle Translator kurulum talimatları:")
    print("1. Chrome'da açılan extensions sayfasında 'Developer mode'u açın")
    print("2. 'Load unpacked' butonuna tıklayın")
    print(f"3. Şu klasörü seçin: {extension_path}")
    print("\nKurulum tamamlandığında YouTube'a gidip bir video açabilirsiniz!")

def main():
    print("YouTube Subtitle Translator başlatılıyor...")
    
    # Backend'i ayrı bir thread'de başlat
    backend_thread = Thread(target=run_backend, daemon=True)
    backend_thread.start()
    
    # Backend'in başlamasını bekle
    time.sleep(2)
    
    # Extension kurulum talimatlarını göster
    install_extension()
    
    print("\nProgram çalışıyor. Kapatmak için Ctrl+C'ye basın...")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nProgram kapatılıyor...")
        sys.exit(0)

if __name__ == "__main__":
    main()
