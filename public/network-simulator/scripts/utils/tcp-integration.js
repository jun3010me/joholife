// TCP機能をネットワークシミュレーターに統合するモジュール

// TCP機能を既存のシミュレーターに統合する関数
function setupTCPIntegration(simulator) {
    // HTTP通信モード
    simulator.isHTTPMode = false;
    simulator.httpSourceDevice = null;
    simulator.httpTargetDevice = null;
    
    // HTTP通信ボタンのイベントリスナー
    const httpBtn = document.getElementById('http-btn');
    if (httpBtn) {
        httpBtn.addEventListener('click', () => {
            simulator.toggleHTTPMode();
        });
    }
    
    // TCPマネージャーのイベントリスナー設定
    setupTCPEventListeners(simulator);
    
    // TCP状態パネルの初期化
    setupTCPStatusPanel(simulator);
    
    // デバイスにTCP関連機能を追加
    extendDevicesWithTCP(simulator);
    
    // 経路計算機能を初期化
    if (typeof initializeRouteCalculator === 'function') {
        initializeRouteCalculator(simulator);
    }
    
    console.log('TCP機能が正常に統合されました');
    
    // デバッグ用：HTTPパネルを強制表示する関数
    window.showHTTPPanel = function() {
        const httpPanel = document.getElementById('http-status-panel');
        if (httpPanel) {
            httpPanel.style.display = 'block';
            console.log('HTTPパネルを強制表示しました');
        } else {
            console.error('HTTPパネルが見つかりません');
        }
    };
}

// TCPイベントリスナーの設定
function setupTCPEventListeners(simulator) {
    // TCP接続状態変更イベント
    window.tcpManager.addEventListener('connectionStateChange', (data) => {
        console.log(`TCP状態変更: ${data.connection.id} ${data.oldState} → ${data.newState}`);
        updateTCPStatusPanel(simulator);
    });
    
    // セグメント送信イベント（アニメーション表示）
    window.tcpManager.addEventListener('segmentSent', (data) => {
        animateTCPSegment(simulator, data);
    });
    
    // データ受信イベント（HTTPセッションに転送）
    window.tcpManager.addEventListener('dataReceived', (data) => {
        console.log('TCPManager dataReceived:', data.connection.id);
        
        // HTTPセッションを検索（デバイスペアで照合）
        const connection = data.connection;
        const localDevice = connection.localDevice;
        const remoteDevice = connection.remoteDevice;
        
        // 対応するHTTPセッションを見つける
        for (const [sessionId, session] of window.httpSimulator.sessions) {
            const sessionLocal = session.connection.localDevice;
            const sessionRemote = session.connection.remoteDevice;
            
            // デバイスペアが一致する場合（双方向チェック）
            if ((sessionLocal === localDevice && sessionRemote === remoteDevice) ||
                (sessionLocal === remoteDevice && sessionRemote === localDevice)) {
                console.log('HTTPセッションに転送:', sessionId);
                session.handleReceivedData(data.data);
                break;
            }
        }
    });
    
    // HTTP関連イベント
    console.log('HTTPイベントリスナーを登録中...');
    window.httpSimulator.addEventListener('httpRequestStart', (data) => {
        console.log('📨 httpRequestStartイベント受信！');
        const localDevice = data.session.connection.localDevice;
        const remoteDevice = data.session.connection.remoteDevice;
        simulator.updateStatus(`HTTP通信開始: ${localDevice.name || localDevice.id} → ${remoteDevice.name || remoteDevice.id}`);
        
        // HTTPリクエストアニメーション（TCP表示がOFFでも表示）
        console.log('🌐 HTTPリクエストアニメーション開始');
        if (window.animateHTTPMessage) {
            window.animateHTTPMessage(simulator, localDevice, remoteDevice, 'request');
        } else {
            console.warn('⚠️ animateHTTPMessage関数が見つかりません');
        }
    });
    
    window.httpSimulator.addEventListener('httpResponseSent', (data) => {
        console.log('📨 httpResponseSentイベント受信！');
        console.log('🌐 HTTPレスポンス送信アニメーション開始');
        console.log('Received data:', data);
        console.log('window.animateHTTPMessage exists:', !!window.animateHTTPMessage);
        console.log('data.session exists:', !!data.session);
        console.log('data.session.connection exists:', !!(data.session && data.session.connection));

        // HTTPレスポンスアニメーション（TCP表示がOFFでも表示）
        if (window.animateHTTPMessage && data.session && data.session.connection) {
            const localDevice = data.session.connection.localDevice;
            const remoteDevice = data.session.connection.remoteDevice;
            console.log('Animation devices - local:', localDevice?.name, 'remote:', remoteDevice?.name);
            // サーバー → クライアント
            window.animateHTTPMessage(simulator, remoteDevice, localDevice, 'response');
        } else {
            console.warn('⚠️ animateHTTPMessage関数またはセッション情報が見つかりません');
            console.warn('Details:');
            console.warn('- animateHTTPMessage:', !!window.animateHTTPMessage);
            console.warn('- data.session:', !!data.session);
            console.warn('- data.session.connection:', !!(data.session && data.session.connection));
        }
    });
    
    window.httpSimulator.addEventListener('httpResponseReceived', (data) => {
        const duration = data.duration || 0;
        const response = data.response;
        
        // ステータス更新
        simulator.updateStatus(`HTTP通信完了: ${response.statusCode} ${response.statusText} (${duration}ms)`);
        
        // レスポンス内容をダイアログで表示
        let responseContent = `HTTP/${response.version || '1.1'} ${response.statusCode} ${response.statusText}\n\n`;
        
        // ヘッダー情報
        if (response.headers) {
            Object.entries(response.headers).forEach(([key, value]) => {
                responseContent += `${key}: ${value}\n`;
            });
        }
        
        responseContent += '\n';
        
        // レスポンスボディ
        if (response.body) {
            responseContent += response.body;
        }
        
        // レスポンス表示ダイアログ
        setTimeout(() => {
            if (confirm('HTTPレスポンスを受信しました。詳細を確認しますか？')) {
                alert(responseContent);
            }
        }, 100);
    });
    
    
    // 接続確立完了イベント
    window.tcpManager.addEventListener('connectionEstablished', (data) => {
        simulator.updateStatus(`TCP接続確立: ${data.connection.localDevice.name || data.connection.localDevice.id} ⟷ ${data.connection.remoteDevice.name || data.connection.remoteDevice.id}`);
        updateTCPStatusPanel(simulator);
    });
}

// TCP状態パネルの設定
function setupTCPStatusPanel(simulator) {
    const panel = document.getElementById('tcp-status-panel');
    if (panel) {
        // 初期は非表示
        panel.style.display = 'none';
    }
}

// TCP状態パネルの更新
function updateTCPStatusPanel(simulator) {
    const panel = document.getElementById('tcp-status-panel');
    const connectionsList = document.getElementById('tcp-connections-list');
    
    if (!panel || !connectionsList) return;
    
    const connections = window.tcpManager.getAllConnections();
    
    if (connections.length === 0) {
        connectionsList.innerHTML = '<div style="color: #666; font-style: italic;">接続なし</div>';
        // ログ表示がOFFなら非表示、ONなら表示（未定義の場合はfalseとして扱う）
        if (!window.showLogPanels) {
            panel.style.display = 'none';
        }
        return;
    }
    
    // ログ表示がONの場合のみ表示
    if (window.showLogPanels) {
        panel.style.display = 'block';
    }
    
    connectionsList.innerHTML = connections.map(conn => {
        const info = conn.getConnectionInfo();
        const stateClass = info.state.toLowerCase().replace('_', '-');
        const localName = info.localDevice;
        const remoteName = info.remoteDevice;
        
        return `
            <div class="tcp-connection-item ${stateClass}">
                <div style="font-weight: bold;">${localName}:${info.localPort} ⟷ ${remoteName}:${info.remotePort}</div>
                <div style="color: #666; font-size: 10px;">
                    状態: ${info.state} | 送信: ${info.sentSegments} | 受信: ${info.receivedSegments}
                </div>
            </div>
        `;
    }).join('');
}

// デバイスにTCP機能を拡張
function extendDevicesWithTCP(simulator) {
    // 既存のデバイス作成関数を拡張
    const originalCreateDevice = simulator.createDevice.bind(simulator);
    simulator.createDevice = function(type, x, y) {
        const device = originalCreateDevice(type, x, y);
        
        // TCP関連機能を追加
        device.receiveSegment = function(segment, connection) {
            console.log(`${this.name || this.id} でTCPセグメント受信:`, segment.toString());
            
            if (connection) {
                connection.receiveSegment(segment);
            } else {
                console.warn('TCP接続が見つかりません:', segment.toString());
            }
        };
        
        // サーバータイプの場合はHTTPサーバー機能を有効にする
        if (type === 'server') {
            window.httpSimulator.setupSampleServer(device, 80);
            // HTTPハンドラーを確実に設定
            device.httpHandler = function(request, session) {
                console.log('HTTPリクエスト受信:', request.method, request.path);
                return {
                    statusCode: 200,
                    statusText: 'OK',
                    headers: { 'Content-Type': 'text/html' },
                    body: '<h1>Hello from Network Simulator!</h1>'
                };
            };
            console.log('HTTPハンドラー設定完了:', device.name);
        }
        
        return device;
    };
    
    // HTTP通信モードの切り替え
    simulator.toggleHTTPMode = function() {
        if (this.isHTTPMode) {
            // HTTP通信モードを終了
            this.isHTTPMode = false;
            this.httpSourceDevice = null;
            this.httpTargetDevice = null;
            this.updateStatus('HTTP通信モードを終了しました');
        } else {
            // HTTP通信モードを開始
            this.isHTTPMode = true;
            this.isPingMode = false; // Pingモードは無効にする
            this.pingSourceDevice = null;
            this.pingTargetDevice = null;
            this.updateStatus('HTTP通信を行うクライアントとサーバーを選択してください');
        }
        this.updateControlButtons(); // ボタンの状態を更新
        this.scheduleRender();
    };
    
    // 既存のデバイスクリックハンドラーを拡張
    const originalHandleDeviceClick = simulator.handleDeviceClick.bind(simulator);
    simulator.handleDeviceClick = function(clickedDevice, event) {
        if (this.isHTTPMode) {
            this.handleHTTPModeClick(clickedDevice);
            return;
        }
        
        // 元の処理を実行
        originalHandleDeviceClick(clickedDevice, event);
    };
    
    // HTTP通信用のデバイスクリック処理
    simulator.handleHTTPModeClick = function(clickedDevice) {
        if (!this.httpSourceDevice) {
            // 送信元を選択
            this.httpSourceDevice = clickedDevice;
            this.updateStatus(`HTTP送信元に ${clickedDevice.name} を選択しました。次にサーバーを選択してください。`);
        } else if (this.httpSourceDevice === clickedDevice) {
            // 同じデバイスをクリック → 選択解除
            this.httpSourceDevice = null;
            this.updateStatus('HTTP送信元の選択を解除しました。クライアントを選択してください。');
        } else {
            // 送信先を選択 → HTTP通信実行
            this.httpTargetDevice = clickedDevice;
            this.executeHTTPCommunication(this.httpSourceDevice, this.httpTargetDevice);
            
            // HTTP通信モードを終了
            this.isHTTPMode = false;
            this.httpSourceDevice = null;
            this.httpTargetDevice = null;
            document.getElementById('http-btn').textContent = '🌐 HTTP';
        }
        this.scheduleRender();
    };
    
    // HTTP通信の実行
    simulator.executeHTTPCommunication = function(client, server) {
        console.log(`HTTP通信開始: ${client.name || client.id} → ${server.name || server.id}`);
        
        // IPアドレスの検証
        if (!client.config.ipAddress || client.config.ipAddress === '0.0.0.0') {
            this.updateStatus(`❌ HTTP通信失敗: ${client.name} にIPアドレスが設定されていません`);
            return;
        }
        
        if (!server.config.ipAddress || server.config.ipAddress === '0.0.0.0') {
            this.updateStatus(`❌ HTTP通信失敗: ${server.name} にIPアドレスが設定されていません`);
            return;
        }
        
        // 通信可能性の検証
        const reachabilityResult = this.checkNetworkReachability(client, server);
        if (!reachabilityResult.isReachable) {
            this.updateStatus(`❌ HTTP通信失敗: ${client.name} と ${server.name} は通信できません (${reachabilityResult.reason})`);
            return;
        }
        
        // 既存の接続をクリア（重複防止）
        console.log('既存のTCP接続をクリア中...');
        const existingConnections = window.tcpManager.getConnectionsForDevice(client)
            .concat(window.tcpManager.getConnectionsForDevice(server));
        
        existingConnections.forEach(conn => {
            console.log('クリア対象接続:', conn.id);
            conn.clearRetransmissionTimer();
            window.tcpManager.removeConnection(conn.id);
        });
        
        // HTTPセッションもクリア
        window.httpSimulator.clearAllSessions();
        
        this.updateStatus(`🌐 HTTP通信を開始中: ${client.name} → ${server.name}`);
        
        // 少し遅延してからHTTPリクエストを送信（クリア処理の完了を待つ）
        setTimeout(() => {
            const session = window.httpSimulator.sendRequest(client, server, {
                method: 'GET',
                path: '/',
                headers: {
                    'Host': server.config.ipAddress,
                    'User-Agent': 'NetworkSimulator/1.0'
                }
            });
            
            if (!session) {
                this.updateStatus(`❌ HTTP通信失敗: セッションの作成に失敗しました`);
            }
        }, 100);
    };
    
    // デバイス描画に HTTP モードのハイライトを追加
    const originalDrawDevice = simulator.drawDevice.bind(simulator);
    simulator.drawDevice = function(device) {
        let httpHighlight = null;
        
        if (this.isHTTPMode) {
            if (device === this.httpSourceDevice) {
                httpHighlight = 'source';
            } else if (device === this.httpTargetDevice) {
                httpHighlight = 'target';
            }
        }
        
        // 元の描画処理を呼び出し（引数を拡張）
        originalDrawDevice(device, httpHighlight);
    };
    
    // クリアボタンの処理を拡張
    const originalClearAll = simulator.clearAll.bind(simulator);
    simulator.clearAll = function() {
        // TCP接続をクリア
        window.tcpManager.clearAllConnections();
        window.httpSimulator.clearAllSessions();
        
        // HTTP通信モードをリセット
        this.isHTTPMode = false;
        this.httpSourceDevice = null;
        this.httpTargetDevice = null;
        document.getElementById('http-btn').textContent = '🌐 HTTP';
        
        // TCP状態パネルを隠す
        const tcpPanel = document.getElementById('tcp-status-panel');
        if (tcpPanel) {
            tcpPanel.style.display = 'none';
        }
        
        // HTTPパネルも隠す
        const httpPanel = document.getElementById('http-status-panel');
        if (httpPanel) {
            httpPanel.style.display = 'none';
        }
        
        // 元のクリア処理を実行
        originalClearAll();
    };
    
    // コントロールボタン更新を拡張
    const originalUpdateControlButtons = simulator.updateControlButtons.bind(simulator);
    simulator.updateControlButtons = function() {
        // 元の処理を実行
        originalUpdateControlButtons();
        
        // HTTPボタンの制御
        const hasDevices = this.devices.size > 0;
        const hasPingableDevices = this.devices.size >= 2;
        const httpBtn = document.getElementById('http-btn');
        
        if (httpBtn) {
            httpBtn.disabled = !hasPingableDevices || this.isPingMode;
            
            // HTTPボタンのテキストを動的に変更
            if (this.isHTTPMode) {
                httpBtn.textContent = '⏹️ HTTP終了';
                httpBtn.style.backgroundColor = '#f44336';
            } else {
                httpBtn.textContent = '🌐 HTTP';
                httpBtn.style.backgroundColor = '#2196f3';
            }
        }
        
        // 設定ボタンもHTTPモード中は無効にする
        const configBtn = document.getElementById('config-btn');
        if (configBtn) {
            const hasSelectedDevice = this.selectedDevice !== null;
            configBtn.disabled = !hasSelectedDevice || this.isPingMode || this.isHTTPMode;
        }
    };
}

console.log('TCP Integration module loaded successfully');