// Supabase bağlantısı - 1sthillman/qr projesine uyumlu
const SUPABASE_URL = 'https://wihdzkvgttfwsiijxidy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpaGR6a3ZndHRmd3NpaWp4aWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2MzA0MjIsImV4cCI6MjA2NjIwNjQyMn0.Cpn6y7ybyLA3uL-bjvsxPKoIw-J7I6eTE5cPGnBjOo4';

// Global değişkenler
let supabase;
let restaurantId = '';
let tableNumber = '';
let tableId = null;
let currentCallId = null;
let isCallActive = false;
let currentStatus = 'idle';
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

// Meteor efekti için yardımcı fonksiyon
function createMeteors(container, count = 20, status = 'idle') {
    // Önce mevcut meteorları temizle
    const existingMeteors = container.querySelectorAll('.meteor');
    existingMeteors.forEach(meteor => meteor.remove());
    
    // Meteor rengi duruma göre belirlenir
    let meteorColor = 'bg-slate-500'; // Varsayılan renk
    let meteorGradient = 'before:from-[#64748b]'; // Varsayılan gradient
    
    if (status === 'calling') {
        meteorColor = 'bg-red-500';
        meteorGradient = 'before:from-[#ef4444]';
    } else if (status === 'serving') {
        meteorColor = 'bg-green-500';
        meteorGradient = 'before:from-[#22c55e]';
    }
    
    // Yeni meteorları oluştur
    for (let i = 0; i < count; i++) {
        const meteor = document.createElement('span');
        meteor.className = `meteor absolute h-0.5 w-0.5 rounded-full ${meteorColor} shadow-[0_0_0_1px_#ffffff10] rotate-[215deg]`;
        
        // Meteor kuyruğu (gradient)
        meteor.innerHTML = '<span class="absolute top-1/2 transform -translate-y-1/2 w-[50px] h-[1px] ' + 
                          `bg-gradient-to-r ${meteorGradient} to-transparent"></span>`;
        
        // Rastgele pozisyon ve animasyon gecikmesi
        meteor.style.top = '0';
        meteor.style.left = Math.floor(Math.random() * (400 - -400) + -400) + 'px';
        meteor.style.animationDelay = Math.random() * (0.8 - 0.2) + 0.2 + 's';
        meteor.style.animationDuration = Math.floor(Math.random() * (10 - 2) + 2) + 's';
        
        // Meteor animasyonu
        meteor.style.animation = 'meteor 5s linear infinite';
        
        container.appendChild(meteor);
    }
}

// Meteor animasyonu için CSS ekle
function addMeteorStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        @keyframes meteor {
            0% { transform: rotate(215deg) translateX(0); opacity: 1; }
            70% { opacity: 1; }
            100% { transform: rotate(215deg) translateX(-500px); opacity: 0; }
        }
        
        .meteor {
            animation: meteor 5s linear infinite;
        }
        
        .table-card {
            position: relative;
            overflow: hidden;
            width: 100%;
            max-width: 200px;
            height: 200px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 10px;
            background-color: rgba(26, 26, 37, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        
        .tables-container {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 20px;
            margin-top: 20px;
        }
    `;
    document.head.appendChild(styleEl);
}

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', function() {
    console.log('Sayfa yüklendi');
    
    // Meteor animasyonu için CSS ekle
    addMeteorStyles();
    
    // URL parametrelerini al
    const urlParams = new URLSearchParams(window.location.search);
    restaurantId = urlParams.get('restaurant_id');
    
    // table_id veya table parametresi kontrolü
    tableNumber = urlParams.get('table_id') || urlParams.get('table');
    
    // Değerler yoksa hata göster ve yükleme ekranını kaldır
    if (!restaurantId || !tableNumber) {
        hideLoader();
        showError('QR kodda eksik bilgi var. Lütfen geçerli bir QR kod kullanın.');
        console.error('Eksik parametreler:', { restaurantId, tableNumber });
        return;
    }
    
    console.log('Parametreler alındı:', { restaurantId, tableNumber });
    
    // Oturum kontrolü - sadece istatistik amaçlı
    const sessionKey = `session_${restaurantId}_${tableNumber}`;
    const sessionStartTime = localStorage.getItem(sessionKey);
    
    if (!sessionStartTime) {
        // Yeni oturum başlat - bu sadece istatistik amaçlı
        localStorage.setItem(sessionKey, Date.now().toString());
        console.log('Yeni oturum başlatıldı');
    } else {
        console.log('Mevcut oturum devam ediyor');
    }
    
    // Supabase'i başlat
    if (!initSupabase()) {
        // Başarısız olsa bile yükleme ekranını kapat
        hideLoader();
        return;
    }
    
    // Masa ve restoran bilgilerini göster
    document.getElementById('restaurantName').textContent = `Restaurant ${restaurantId}`;
    
    // Masa kaydını kontrol et veya oluştur
    checkOrCreateTable()
        .catch(err => {
            console.error('Masa kontrolü sırasında hata:', err);
            showError('Bağlantı hatası. Lütfen sayfayı yenileyin.');
        })
        .finally(() => {
            // İşlem başarılı veya başarısız olsa da yükleme ekranını kaldır
            hideLoader();
        });
    
    // Çağrı butonunu ayarla
    setupCallButton();
    
    // Yükleme yavaş olsa bile 5 saniye sonra her durumda yükleme ekranını gizle
    setTimeout(hideLoader, 5000);
    
    // Meteor efektini başlat
    const qrPage = document.getElementById('qrPage');
    if (qrPage) {
        createMeteors(qrPage, 20, currentStatus);
    }
});

// Yükleme ekranını gizle
function hideLoader() {
    const loader = document.getElementById('loadingPage');
    const content = document.getElementById('qrPage');
    
    if (loader) {
        loader.style.display = 'none';
    }
    
    if (content) {
        content.style.display = 'flex';
    }
}

// Supabase istemcisini başlat
function initSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase bağlantısı başarılı');
        
        // Supabase ile bağlantıyı test et
        supabase.from('tables').select('id').limit(1)
            .then(response => {
                if (response.error) throw new Error('Supabase bağlantı testi başarısız');
                console.log('Supabase bağlantı testi başarılı');
            })
            .catch(err => {
                console.error('Supabase bağlantı testi hatası:', err);
                retrySupabaseConnection();
            });
        
        return true;
    } catch (error) {
        console.error('Supabase başlatma hatası:', error);
        showError('Veritabanı bağlantısı kurulamadı. Lütfen tekrar deneyin.');
        retrySupabaseConnection();
        return false;
    }
}

// Supabase bağlantısını yeniden deneme
function retrySupabaseConnection() {
    connectionAttempts++;
    if (connectionAttempts <= MAX_CONNECTION_ATTEMPTS) {
        console.log(`Supabase bağlantısı yeniden deneniyor (${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})...`);
        setTimeout(initSupabase, 1000);
    } else {
        console.error('Maksimum bağlantı deneme sayısına ulaşıldı');
        showError('Sunucu bağlantısı kurulamadı. Lütfen internet bağlantınızı kontrol edin ve sayfayı yenileyin.');
    }
}

// Masa kaydını kontrol et veya oluştur
async function checkOrCreateTable() {
    if (!supabase) return;
    
    try {
        console.log(`Masa kontrolü yapılıyor: Restaurant ${restaurantId}, Masa ${tableNumber}`);
        
        // Önce masa var mı kontrol et
        const { data, error } = await supabase
            .from('tables')
            .select('id, status')
            .eq('restaurant_id', restaurantId)
            .eq('table_id', parseInt(tableNumber))
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116: No rows returned
            console.error('Masa sorgusu hatası:', error);
            return;
        }
        
        if (data) {
            // Masa bulundu
            tableId = data.id;
            currentStatus = data.status || 'idle';
            console.log(`Masa bulundu: ID=${tableId}, Status=${currentStatus}`);
        } else {
            // Masa yoksa oluştur
            const { data: newTable, error: insertError } = await supabase
                .from('tables')
                .insert({
                    restaurant_id: restaurantId,
                    table_id: parseInt(tableNumber),
                    number: parseInt(tableNumber),
                    status: 'idle'
                })
                .select()
                .single();
            
            if (insertError) {
                console.error('Masa oluşturma hatası:', insertError);
                return;
            }
            
            tableId = newTable.id;
            currentStatus = 'idle';
            console.log(`Yeni masa oluşturuldu: ID=${tableId}`);
        }
        
        // Aktif çağrı var mı kontrol et
        checkActiveCall();
        
        // Realtime bağlantıyı kur
        setupRealtimeConnection();
        
    } catch (err) {
        console.error('Masa kontrolü hatası:', err);
        throw err;
    }
}

// Aktif çağrı var mı kontrol et
async function checkActiveCall() {
    if (!supabase || !tableId) return;
    
    try {
        const { data, error } = await supabase
            .from('calls')
            .select('id, status')
            .eq('table_id', tableId)
            .eq('status', 'requested')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Çağrı sorgusu hatası:', error);
            return;
        }
        
        if (data) {
            // Aktif çağrı var
            currentCallId = data.id;
            isCallActive = true;
            currentStatus = 'calling';
            console.log(`Aktif çağrı bulundu: ID=${currentCallId}`);
            
            // Buton durumunu güncelle
            updateButtonState();
        }
    } catch (err) {
        console.error('Aktif çağrı kontrolü hatası:', err);
    }
}

// Çağrı butonunu ayarla
function setupCallButton() {
    const callButton = document.getElementById('callWaiterButton');
    
    if (!callButton) return;
    
    callButton.addEventListener('click', function() {
        callWaiter();
    });
    
    // Başlangıç durumunu ayarla
    updateButtonState();
}

// Garson çağırma fonksiyonu
async function callWaiter() {
    if (!supabase || !tableId) {
        showError('Bağlantı hatası. Lütfen sayfayı yenileyin.');
        return;
    }
    
    // Zaten aktif bir çağrı varsa
    if (isCallActive) {
        showError('Zaten aktif bir çağrınız var.');
        return;
    }
    
    // Buton durumunu güncelle
    const callButton = document.getElementById('callWaiterButton');
    if (callButton) {
        callButton.disabled = true;
        callButton.innerHTML = '<i class="ri-loader-4-line animate-spin mr-2"></i> Çağrılıyor...';
    }
    
    try {
        // Yeni çağrı oluştur
        const { data, error } = await supabase
            .from('calls')
            .insert([
                { 
                    restaurant_id: restaurantId,
                    table_id: tableId,
                    table_number: tableNumber,
                    status: 'pending'
                }
            ])
            .select();
        
        if (error) {
            console.error('Çağrı oluşturulurken hata:', error);
            showError('Çağrı oluşturulamadı. Lütfen tekrar deneyin.');
            
            // Butonu tekrar aktif et
            if (callButton) {
                callButton.disabled = false;
                callButton.innerHTML = '<i class="ri-user-voice-line mr-2"></i> Garsonu Çağır';
            }
            return;
        }
        
        // Çağrı başarılı
        console.log('Çağrı oluşturuldu:', data);
        currentCallId = data[0].id;
        isCallActive = true;
        currentStatus = 'calling';
        
        // Meteor efektini güncelle
        updateTableMeteors();
        
        // Masa durumunu güncelle
        const { error: tableUpdateError } = await supabase
            .from('tables')
            .update({ status: 'calling' })
            .eq('id', tableId);
        
        if (tableUpdateError) {
            console.error('Masa durumu güncellenirken hata:', tableUpdateError);
        }
        
        showSuccess('Garson çağrınız alındı. En kısa sürede sizinle ilgileneceğiz.');
        
        // Buton durumunu güncelle
        updateButtonState();
        
        // Realtime bağlantıyı yeniden kur
        setupRealtimeConnection();
        
    } catch (err) {
        console.error('Garson çağırma sırasında hata:', err);
        showError('Bir hata oluştu. Lütfen tekrar deneyin.');
        
        // Butonu tekrar aktif et
        if (callButton) {
            callButton.disabled = false;
            callButton.innerHTML = '<i class="ri-user-voice-line mr-2"></i> Garsonu Çağır';
        }
    }
}

// Buton durumunu güncelle
function updateButtonState() {
    const callButton = document.getElementById('callWaiterButton');
    if (!callButton) return;
    
    // Önce tüm sınıfları temizle
    callButton.classList.remove('calling', 'serving', 'ready-to-recall');
    
    // Masa durumuna göre meteor efektini güncelle
    updateTableMeteors();
    
    // Normal durum güncellemesi - önceki çağrı yok veya idle durumunda
    if (currentStatus === 'calling') {
        callButton.disabled = true;
        callButton.classList.add('calling');
        callButton.innerHTML = '<i class="ri-time-line mr-2"></i> Garson Geliyor';
    } else if (currentStatus === 'serving') {
        callButton.disabled = true;
        callButton.classList.add('serving');
        callButton.innerHTML = '<i class="ri-user-smile-line mr-2"></i> Garson Geliyor';
    } else {
        // idle durumu - çağrı yapılabilir
        callButton.disabled = false;
        callButton.innerHTML = '<i class="ri-user-voice-line mr-2"></i> Garsonu Çağır';
    }
}

// Masa durumuna göre meteor efektini güncelle
function updateTableMeteors() {
    // Masa numarasına göre ilgili masa kartını bul
    const tableCard = document.querySelector(`.table-card[data-table="${tableNumber}"]`);
    if (!tableCard) return;
    
    // Duruma göre meteor rengini ayarla
    tableCard.setAttribute('data-status', currentStatus);
    
    // Meteor efektini güncelle
    createMeteors(tableCard, 10, currentStatus);
}

// Butonu sıfırla
function resetCallButton(button) {
    if (!button) return;
    
    button.disabled = false;
    button.innerHTML = '<i class="ri-user-voice-line mr-2"></i> Garsonu Çağır';
}

// Realtime bağlantıyı kur
function setupRealtimeConnection() {
    if (!supabase) {
        console.error('Supabase bağlantısı yok, realtime dinleme yapılamıyor');
        return;
    }
    
    if (!tableId) {
        console.error('Masa ID yok, realtime dinleme yapılamıyor');
        return;
    }
    
    console.log('Realtime bağlantı kuruluyor...', { tableId, currentCallId });
    
    try {
        // Önceki kanalları temizle
        supabase.removeAllChannels();
        
        // Masa durumu değişikliklerini dinle
        const tableChannel = supabase
            .channel(`table-status-${tableId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'tables',
                filter: `id=eq.${tableId}`
            }, payload => {
                console.log('Masa durumu değişti:', payload);
                
                if (payload.new && payload.new.status) {
                    currentStatus = payload.new.status;
                    console.log(`Masa durumu güncellendi: ${currentStatus}`);
                    
                    // Meteor efektini güncelle
                    updateTableMeteors();
                    
                    if (currentStatus === 'serving') {
                        showWaiterResponse('Garsonunuz geliyor!');
                        
                        // Buton durumunu güncelle
                        const callButton = document.getElementById('callWaiterButton');
                        if (callButton) {
                            callButton.disabled = true;
                            callButton.classList.add('serving');
                            callButton.classList.remove('calling', 'ready-to-recall');
                            callButton.innerHTML = '<i class="ri-user-smile-line mr-2"></i> Garson Geliyor';
                        }
                    } else if (currentStatus === 'idle') {
                        isCallActive = false;
                        currentCallId = null;
                        showWaiterResponse('Çağrınız tamamlandı.');
                        
                        // Butonu normal haline getir
                        const callButton = document.getElementById('callWaiterButton');
                        if (callButton) {
                            // Butonu aktifleştir
                            callButton.disabled = false;
                            callButton.classList.remove('calling', 'serving', 'ready-to-recall');
                            callButton.innerHTML = '<i class="ri-user-voice-line mr-2"></i> Garsonu Çağır';
                        }
                    }
                    
                    // Her durumda butonun genel durumunu güncelle
                    updateButtonState();
                }
            })
            .subscribe(status => {
                console.log('Masa durumu dinleme durumu:', status);
            });
        
        // Çağrı durumu değişikliklerini dinle
        if (currentCallId) {
            const callChannel = supabase
                .channel(`call-status-${currentCallId}`)
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'calls',
                    filter: `id=eq.${currentCallId}`
                }, payload => {
                    console.log('Çağrı durumu değişti:', payload);
                    
                    if (payload.new && payload.new.status === 'acknowledged') {
                        showWaiterResponse('Garsonunuz çağrınızı onayladı ve geliyor!');
                        isCallActive = false;
                        currentStatus = 'serving';
                        
                        // Meteor efektini güncelle
                        updateTableMeteors();
                        
                        updateButtonState();
                    }
                })
                .subscribe(status => {
                    console.log('Çağrı durumu dinleme durumu:', status);
                });
        }
    } catch (error) {
        console.error('Realtime bağlantı kurulurken hata:', error);
    }
}

// Hata mesajı göster
function showError(message) {
    const errorAlert = document.getElementById('errorAlert');
    if (errorAlert) {
        errorAlert.textContent = message;
        errorAlert.style.display = 'block';
        
        // 5 saniye sonra gizle
        setTimeout(() => {
            errorAlert.style.display = 'none';
        }, 5000);
    }
    console.error(message);
}

// Başarı mesajı göster
function showSuccess(message) {
    const successAlert = document.getElementById('successAlert');
    if (successAlert) {
        successAlert.textContent = message;
        successAlert.style.display = 'block';
        
        // 5 saniye sonra gizle
        setTimeout(() => {
            successAlert.style.display = 'none';
        }, 5000);
    }
    console.log(message);
}

// Garson cevabı göster
function showWaiterResponse(message) {
    const responseAlert = document.getElementById('waiterResponseAlert');
    if (responseAlert) {
        responseAlert.textContent = message;
        responseAlert.style.display = 'block';
        
        // 5 saniye sonra gizle
        setTimeout(() => {
            responseAlert.style.display = 'none';
        }, 5000);
    }
    console.log('Garson cevabı:', message);
}

// Butonu tekrar çağırma durumuna getir
function enableRecallButton() {
    const callButton = document.getElementById('callWaiterButton');
    if (!callButton) return;
    
    callButton.disabled = false;
    callButton.classList.remove('calling', 'serving');
    callButton.classList.add('ready-to-recall');
    callButton.innerHTML = '<i class="ri-user-voice-line mr-2"></i> Tekrar Çağır';
} 