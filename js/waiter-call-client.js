// Supabase bağlantısı
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

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', function() {
    console.log('Sayfa yüklendi');
    
    // URL parametrelerini al
    const urlParams = new URLSearchParams(window.location.search);
    restaurantId = urlParams.get('restaurant_id');
    tableNumber = urlParams.get('table_id') || urlParams.get('table');
    
    // Değerler yoksa hata göster ve yükleme ekranını kaldır
    if (!restaurantId || !tableNumber) {
        hideLoader();
        showError('QR kodda eksik bilgi var. Lütfen geçerli bir QR kod kullanın.');
        console.error('Eksik parametreler:', { restaurantId, tableNumber });
        return;
    }
    
    console.log('Parametreler alındı:', { restaurantId, tableNumber });
    
    // Masa ve restoran bilgilerini göster
    document.getElementById('restaurantName').textContent = `Restaurant ${restaurantId}`;
    document.getElementById('tableNumber').textContent = tableNumber;
    
    // Supabase'i başlat
    initSupabase();
    
    // Çağrı butonunu ayarla
    setupCallButton();
    
    // Yükleme ekranını 3 saniye sonra her durumda kaldır
    setTimeout(hideLoader, 3000);
});

// Yükleme ekranını gizle
function hideLoader() {
    const loader = document.getElementById('loadingPage');
    const content = document.getElementById('qrPage');
    
    if (loader) {
        loader.style.display = 'none';
    }
    
    if (content) {
        content.style.display = 'block';
    }
}

// Supabase istemcisini başlat
function initSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase bağlantısı başarılı');
        
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
            
        return true;
    } catch (error) {
        console.error('Supabase başlatma hatası:', error);
        showError('Veritabanı bağlantısı kurulamadı. Lütfen tekrar deneyin.');
        hideLoader();
        return false;
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
            .eq('number', parseInt(tableNumber))
            .maybeSingle();
        
        if (error) {
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
        await checkActiveCall();
        
        // Buton durumunu güncelle
        updateButtonState();
        
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
            .maybeSingle();
        
        if (error) {
            console.error('Çağrı sorgusu hatası:', error);
            return;
        }
        
        if (data) {
            // Aktif çağrı var
            currentCallId = data.id;
            isCallActive = true;
            currentStatus = 'calling';
            console.log(`Aktif çağrı bulundu: ID=${currentCallId}`);
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
        callButton.innerHTML = '<span style="margin-right: 8px;">⏳</span> Çağrılıyor...';
    }
    
    try {
        // Yeni çağrı oluştur
        const { data, error } = await supabase
            .from('calls')
            .insert([
                { 
                    restaurant_id: restaurantId,
                    table_id: tableId,
                    status: 'requested'
                }
            ])
            .select();
        
        if (error) {
            console.error('Çağrı oluşturulurken hata:', error);
            showError('Çağrı oluşturulamadı. Lütfen tekrar deneyin.');
            
            // Butonu tekrar aktif et
            if (callButton) {
                callButton.disabled = false;
                callButton.innerHTML = '<span style="margin-right: 8px;">👋</span> Garsonu Çağır';
            }
            return;
        }
        
        // Çağrı başarılı
        console.log('Çağrı oluşturuldu:', data);
        currentCallId = data[0].id;
        isCallActive = true;
        currentStatus = 'calling';
        
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
        
    } catch (err) {
        console.error('Garson çağırma sırasında hata:', err);
        showError('Bir hata oluştu. Lütfen tekrar deneyin.');
        
        // Butonu tekrar aktif et
        if (callButton) {
            callButton.disabled = false;
            callButton.innerHTML = '<span style="margin-right: 8px;">👋</span> Garsonu Çağır';
        }
    }
}

// Buton durumunu güncelle
function updateButtonState() {
    const callButton = document.getElementById('callWaiterButton');
    if (!callButton) return;
    
    // Önce tüm sınıfları temizle
    callButton.classList.remove('calling', 'serving', 'ready-to-recall');
    
    // Normal durum güncellemesi
    if (currentStatus === 'calling') {
        callButton.disabled = true;
        callButton.classList.add('calling');
        callButton.innerHTML = '<span style="margin-right: 8px;">⏳</span> Garson Geliyor';
    } else if (currentStatus === 'serving') {
        callButton.disabled = true;
        callButton.classList.add('serving');
        callButton.innerHTML = '<span style="margin-right: 8px;">✅</span> Garson Geliyor';
    } else {
        // idle durumu - çağrı yapılabilir
        callButton.disabled = false;
        callButton.innerHTML = '<span style="margin-right: 8px;">👋</span> Garsonu Çağır';
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