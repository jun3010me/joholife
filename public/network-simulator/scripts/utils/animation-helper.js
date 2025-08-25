// アニメーション関連のヘルパー関数モジュール
console.log('🔄 Animation Helper リロード中... (経路ベースアニメーション対応版)');

// ユーティリティ関数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// アニメーション時間計算機能
function calculateAnimationDuration(simulator, source, destination, options = {}) {
    const {
        hopDuration = 400,
        hopDelay = 50
    } = options;
    
    // 経路を計算（シミュレーターの機能を使用）
    if (window.simulator && typeof window.simulator.findPath === 'function') {
        // console.log('シミュレーターを使用して経路時間を計算中:', source.name || source.id, '→', destination.name || destination.id);
        const path = window.simulator.findPath(source, destination);
        
        if (path && path.length > 1) {
            const hops = path.length - 1;
            const totalAnimationTime = (hops * hopDuration) + ((hops - 1) * hopDelay) + 100;
            // console.log(`計算された経路時間: ${totalAnimationTime}ms (${hops}ホップ)`);
            return totalAnimationTime;
        }
    }
    
    // フォールバック: デフォルト時間
    // console.log('デフォルト時間を使用:', hopDuration + 100, 'ms');
    return hopDuration + 100;
}

// 経路に沿ったパケットアニメーション（統一関数）
async function animatePacketAlongPath(simulator, path, options = {}) {
    const {
        color = '#ff4444',
        text = 'PACKET',
        className = 'packet',
        hopDuration = 500,
        hopDelay = 100,
        onHopComplete = null,
        onComplete = null
    } = options;

    if (!path || path.length < 2) {
        console.warn('アニメーション用の有効な経路がありません');
        if (onComplete) onComplete();
        return;
    }

    // console.log('経路アニメーション開始:', text, 'path:', path.map(d => d.name || d.id).join(' → '));

    // 各ホップに対してアニメーションを実行
    for (let i = 0; i < path.length - 1; i++) {
        const fromDevice = path[i];
        const toDevice = path[i + 1];
        
        // console.log(`ホップ ${i + 1}: ${fromDevice.name || fromDevice.id} → ${toDevice.name || toDevice.id}`);
        
        // 1ホップのアニメーション
        await animateSingleHop(simulator, fromDevice, toDevice, {
            color,
            text,
            className,
            duration: hopDuration
        });
        
        // ホップ完了コールバック
        if (onHopComplete) {
            onHopComplete(i, fromDevice, toDevice);
        }
        
        // ホップ間の遅延（速度調整適用）
        if (i < path.length - 2 && hopDelay > 0) {
            const speedMultiplier = window.animationSpeedMultiplier || 1.0;
            const adjustedDelay = Math.max(10, hopDelay / speedMultiplier);
            await sleep(adjustedDelay);
        }
    }

    // console.log('経路アニメーション完了:', text);
    
    // 完了コールバック
    if (onComplete) {
        onComplete();
    }
}

// 1ホップのアニメーション
function animateSingleHop(simulator, fromDevice, toDevice, options = {}) {
    return new Promise((resolve) => {
        const {
            color = '#ff4444',
            text = 'PACKET',
            className = 'packet',
            duration = 500
        } = options;

        // アニメーション速度マルチプライヤーを適用
        const speedMultiplier = window.animationSpeedMultiplier || 1.0;
        const adjustedDuration = Math.max(50, duration / speedMultiplier); // 最低50ms

        // 送信元と宛先のワールド座標を取得（NIC位置を考慮）
        const sourceWorldPos = getDeviceConnectionPoint(fromDevice, toDevice);
        const destWorldPos = getDeviceConnectionPoint(toDevice, fromDevice);

        // ワールド座標をDOM座標に変換
        const sourcePos = worldToDOM(simulator, sourceWorldPos);
        const destPos = worldToDOM(simulator, destWorldPos);

        // パケット重複回避のためのオフセット計算
        const packetData = calculatePacketOffset(fromDevice, toDevice, text);
        const packetOffset = { x: packetData.x, y: packetData.y };
        const activeCount = packetData.activeCount;

        // パケット要素を作成
        const packet = document.createElement('div');
        packet.className = className;
        packet.textContent = text;
        packet.style.position = 'absolute';
        packet.style.left = (sourcePos.x + packetOffset.x) + 'px';
        packet.style.top = (sourcePos.y + packetOffset.y) + 'px';
        packet.style.backgroundColor = color;
        packet.style.color = 'white';
        packet.style.padding = '2px 4px';
        packet.style.borderRadius = '8px';
        packet.style.fontSize = '7px';
        packet.style.fontWeight = 'bold';
        packet.style.zIndex = '1000';
        packet.style.pointerEvents = 'none';
        packet.style.textAlign = 'center';
        packet.style.minWidth = '20px';
        packet.style.minHeight = '14px';
        packet.style.display = 'flex';
        packet.style.alignItems = 'center';
        packet.style.justifyContent = 'center';
        packet.style.border = '1px solid rgba(255,255,255,0.3)';
        packet.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';

        const canvasContainer = document.querySelector('.canvas-container');
        if (canvasContainer) {
            canvasContainer.appendChild(packet);

            // シミュレーターの接続パスを取得してベジェ曲線でアニメーション
            if (simulator && typeof simulator.getConnectionPath === 'function') {
                const connectionPath = simulator.getConnectionPath(fromDevice, toDevice);
                
                // 複数パケットの場合は少し時間差をつける
                const delayOffset = (activeCount % 3) * 50; // 最大150ms遅延
                
                setTimeout(() => {
                    animateAlongPath(packet, connectionPath, adjustedDuration, packetOffset, resolve);
                }, 50 + delayOffset);
            } else {
                // フォールバック: 直線アニメーション
                const deltaX = destPos.x - sourcePos.x;
                const deltaY = destPos.y - sourcePos.y;

                packet.style.transition = `all ${adjustedDuration}ms ease-in-out`;

                // 複数パケットの場合は少し時間差をつける
                const delayOffset = (activeCount % 3) * 50; // 最大150ms遅延
                setTimeout(() => {
                    packet.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                }, 50 + delayOffset);

                setTimeout(() => {
                    if (packet.parentNode) {
                        packet.parentNode.removeChild(packet);
                    }
                    resolve();
                }, adjustedDuration + 100);
            }
        } else {
            console.error('キャンバスコンテナが見つかりません');
            resolve();
        }
    });
}

// ベジェ曲線に沿ったパケットアニメーション
function animateAlongPath(packet, connectionPath, duration, offset, resolve) {
    const startTime = Date.now();
    
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // イージング関数
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        let worldX, worldY;
        
        // 接続パスに沿って位置を計算
        if (connectionPath.isBezier) {
            // 3次ベジェ曲線
            worldX = Math.pow(1-easeProgress, 3) * connectionPath.startX + 
                     3 * Math.pow(1-easeProgress, 2) * easeProgress * connectionPath.cp1X + 
                     3 * (1-easeProgress) * Math.pow(easeProgress, 2) * connectionPath.cp2X + 
                     Math.pow(easeProgress, 3) * connectionPath.endX;
                     
            worldY = Math.pow(1-easeProgress, 3) * connectionPath.startY + 
                     3 * Math.pow(1-easeProgress, 2) * easeProgress * connectionPath.cp1Y + 
                     3 * (1-easeProgress) * Math.pow(easeProgress, 2) * connectionPath.cp2Y + 
                     Math.pow(easeProgress, 3) * connectionPath.endY;
        } else {
            // 直線
            worldX = connectionPath.startX + (connectionPath.endX - connectionPath.startX) * easeProgress;
            worldY = connectionPath.startY + (connectionPath.endY - connectionPath.startY) * easeProgress;
        }
        
        // ワールド座標をDOM座標に変換
        const simulator = window.simulator;
        const domPos = worldToDOM(simulator, { x: worldX, y: worldY });
        
        // パケットの位置を更新（オフセット適用）
        packet.style.left = (domPos.x + offset.x) + 'px';
        packet.style.top = (domPos.y + offset.y) + 'px';
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // アニメーション完了
            if (packet.parentNode) {
                packet.parentNode.removeChild(packet);
            }
            resolve();
        }
    };
    
    animate();
}

// TCPセグメントのアニメーション（経路ベース）
async function animateTCPSegment(simulator, data) {
    const { segment, source, destination, onAnimationComplete } = data;
    
    // TCP表示がOFFの場合は接続制御パケット（SYN、ACK）をスキップし、DATAパケットのみ表示
    if (window.showTCPPackets === false) {
        // データパケットの判定を複数の方法で試行
        const isDataPacket = (segment.flags && segment.flags.PSH) || 
                           (segment.data && segment.data.length > 0) ||
                           (segment.dataLength && segment.dataLength > 0) ||
                           (segment.hasFlag && segment.hasFlag('PSH'));
        
        if (!isDataPacket) {
            // 制御パケット（SYN、ACK等）はスキップするが、コールバックは実行
            if (onAnimationComplete) {
                // アニメーション時間を模擬する（実際のネットワーク遅延）
                const animationDuration = calculateAnimationDuration(simulator, source, destination, {
                    hopDuration: 400,
                    hopDelay: 50
                });
                setTimeout(onAnimationComplete, animationDuration);
            }
            return;
        }
        // DATAパケットは表示を継続
    }
    
    // セグメントタイプに応じた設定
    let color = '#2196f3';
    let text = 'TCP';
    
    if (segment.hasFlag('SYN') && segment.hasFlag('ACK')) {
        color = '#ff9800';
        text = 'SYN-ACK';
    } else if (segment.hasFlag('SYN')) {
        color = '#ff9800';
        text = 'SYN';
    } else if (segment.hasFlag('FIN')) {
        color = '#f44336';
        text = 'FIN';
    } else if (segment.data && segment.data.length > 0) {
        color = '#9c27b0';
        // TCP表示がOFFの場合はHTTPコンテンツのラベルを使用
        if (window.showTCPPackets === false) {
            // HTTPリクエストかレスポンスかを判定
            const dataStr = segment.data.toString();
            if (dataStr.includes('GET') || dataStr.includes('POST') || dataStr.includes('PUT') || dataStr.includes('DELETE')) {
                text = 'HTTP Request';
                color = '#2196f3';
            } else if (dataStr.includes('HTTP/1.1') || dataStr.includes('HTTP/1.0')) {
                text = 'HTTP Response';
                color = '#4caf50';
            } else {
                text = 'Web Data';
                color = '#9c27b0';
            }
        } else {
            text = 'DATA';
        }
    } else if (segment.hasFlag('ACK')) {
        color = '#4caf50';
        text = 'ACK';
    }

    // console.log('🚀 TCP アニメーション開始:', text, 'from', source.name || source.id, 'to', destination.name || destination.id);
    // console.log('🔍 デバッグ: window.simulator exists:', !!window.simulator);
    // console.log('🔍 デバッグ: simulator.findPath exists:', !!(window.simulator && window.simulator.findPath));

    // 拡張されたPingアニメーションシステムをTCPでも使用
    if (window.simulator && typeof window.simulator.findPath === 'function' && typeof window.simulator.animatePacketAlongPath === 'function') {
        // console.log('🔧 シミュレータの拡張アニメーション機能をTCP用に使用');
        const path = window.simulator.findPath(source, destination);
        
        // console.log('🔍 デバッグ: 見つかった経路:', path);
        
        if (path && path.length > 1) {
            // console.log('✅ 経路が見つかりました:', path.map(d => d.name || d.id).join(' → '));
            
            // セグメントタイプに応じたオフセット（パケット重複回避）
            const typeOffsets = {
                'SYN': { x: 0, y: -15 },
                'ACK': { x: 0, y: 15 },
                'DATA': { x: -20, y: 0 },
                'FIN': { x: 20, y: 0 }
            };
            const offset = typeOffsets[text] || { x: 0, y: 0 };
            
            // キューシステムを使用した拡張アニメーション
            await window.simulator.queuedAnimatePacketAlongPath(path, text, color, {
                hopDelay: 100,        // TCPは高速（Pingより速く）
                packetDuration: 800,  // パケットアニメーション時間
                offsetX: offset.x,    // パケット重複回避用オフセット
                offsetY: offset.y,
                onComplete: onAnimationComplete  // パケット到着時のコールバック
            });
            
            return;
        } else {
            console.warn('⚠️ シミュレータで経路が見つかりません（直接接続または経路なし）');
        }
    } else {
        console.warn('⚠️ window.simulatorまたは必要な関数が利用できません');
        console.log('simulator:', !!window.simulator);
        console.log('findPath:', !!(window.simulator && window.simulator.findPath));
        console.log('animatePacketAlongPath:', !!(window.simulator && window.simulator.animatePacketAlongPath));
    }

    // 経路を計算（RouteCalculatorを使用）
    if (!window.routeCalculator) {
        console.warn('RouteCalculator が初期化されていません。直線アニメーションにフォールバック');
        await animateSingleHop(simulator, source, destination, {
            color,
            text,
            className: 'tcp-segment-animation',
            duration: 1000
        });
        // 直線アニメーション完了後もコールバック実行
        if (onAnimationComplete) {
            onAnimationComplete();
        }
        return;
    }

    const path = window.routeCalculator.findPath(source, destination);
    
    if (path.length === 0) {
        console.warn('経路が見つかりません:', source.name, '→', destination.name);
        // 経路が見つからない場合でもコールバック実行（パケットロス扱い）
        if (onAnimationComplete) {
            console.log('経路なしでもコールバック実行（パケットロス扱い）');
            onAnimationComplete();
        }
        return;
    }

    // 経路に沿ってアニメーション
    await animatePacketAlongPath(simulator, path, {
        color,
        text,
        className: 'tcp-segment-animation',
        hopDuration: 400,
        hopDelay: 50,
        onComplete: onAnimationComplete // パケット到着時のコールバック
    });
}

// Pingアニメーション（経路ベース）
async function animatePingAlongPath(simulator, path, options = {}) {
    const {
        requestColor = '#4caf50',
        responseColor = '#2196f3',
        errorColor = '#f44336',
        requestText = 'PING',
        responseText = 'PONG',
        isError = false
    } = options;

    if (!path || path.length < 2) {
        console.warn('Ping用の有効な経路がありません');
        return;
    }

    if (isError) {
        // エラーの場合は途中で停止
        await animatePacketAlongPath(simulator, path, {
            color: errorColor,
            text: '❌',
            className: 'ping-error',
            hopDuration: 400,
            hopDelay: 100
        });
        return;
    }

    // 往路（Request）
    console.log('Ping往路アニメーション開始');
    await animatePacketAlongPath(simulator, path, {
        color: requestColor,
        text: requestText,
        className: 'ping-request',
        hopDuration: 300,
        hopDelay: 100
    });

    // 中間の待機時間（速度調整適用）
    const speedMultiplier = window.animationSpeedMultiplier || 1.0;
    const adjustedWaitTime = Math.max(50, 200 / speedMultiplier);
    await sleep(adjustedWaitTime);

    // 復路（Response）
    const reversePath = [...path].reverse();
    console.log('Ping復路アニメーション開始');
    await animatePacketAlongPath(simulator, reversePath, {
        color: responseColor,
        text: responseText,
        className: 'ping-response',
        hopDuration: 300,
        hopDelay: 100
    });

    console.log('Pingアニメーション完了');
}

// デバイスの接続ポイント（NIC位置）を取得する関数
function getDeviceConnectionPoint(device, targetDevice) {
    // 単一NICデバイスの場合は実際のNIC位置を使用
    if ((device.type === 'pc' || device.type === 'server') && device.ports && device.ports.nics && device.ports.nics.length > 0) {
        const nic = device.ports.nics[0];
        if (nic.connected) {
            // NICの実際の位置を計算（相対座標から絶対座標に変換）
            return {
                x: device.x + nic.x * device.width,
                y: device.y + nic.y * device.height
            };
        }
    }
    
    // デフォルトはデバイス中央
    return {
        x: device.x + device.width / 2,
        y: device.y + device.height / 2
    };
}

// ワールド座標をDOM座標に変換する関数
function worldToDOM(simulator, worldPos) {
    return {
        x: worldPos.x * simulator.scale + simulator.panX,
        y: worldPos.y * simulator.scale + simulator.panY
    };
}

// パケットアニメーション（既存のPing機能用）
function animatePacket(simulator, fromDevice, toDevice, options = {}) {
    const {
        color = '#ff4444',
        duration = 1000,
        text = 'PING',
        className = 'packet'
    } = options;
    
    // 送信元と宛先の接続ポイント（NIC位置を考慮）を取得
    const sourceWorldPos = getDeviceConnectionPoint(fromDevice, toDevice);
    const destWorldPos = getDeviceConnectionPoint(toDevice, fromDevice);
    
    const sourcePos = worldToDOM(simulator, sourceWorldPos);
    const destPos = worldToDOM(simulator, destWorldPos);
    
    const packet = document.createElement('div');
    packet.className = className;
    packet.textContent = text;
    packet.style.position = 'absolute';
    packet.style.left = sourcePos.x + 'px';
    packet.style.top = sourcePos.y + 'px';
    packet.style.backgroundColor = color;
    packet.style.color = 'white';
    packet.style.padding = '2px 6px';
    packet.style.borderRadius = '50%';
    packet.style.fontSize = '8px';
    packet.style.fontWeight = 'bold';
    packet.style.zIndex = '1000';
    packet.style.pointerEvents = 'none';
    
    const canvasContainer = document.querySelector('.canvas-container');
    if (canvasContainer) {
        canvasContainer.appendChild(packet);
        
        const deltaX = destPos.x - sourcePos.x;
        const deltaY = destPos.y - sourcePos.y;
        
        packet.style.transition = `all ${duration}ms ease-in-out`;
        
        setTimeout(() => {
            packet.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        }, 50);
        
        setTimeout(() => {
            if (packet.parentNode) {
                packet.parentNode.removeChild(packet);
            }
        }, duration + 100);
    }
    
    return packet;
}

// デバイス点滅アニメーション
function blinkDevice(simulator, device, options = {}) {
    const {
        color = '#f44336',
        duration = 200,
        count = 3
    } = options;
    
    let blinkCount = 0;
    const blinkInterval = setInterval(() => {
        if (blinkCount >= count * 2) {
            clearInterval(blinkInterval);
            simulator.errorBlinkDevices = null;
            simulator.scheduleRender();
            return;
        }
        
        if (blinkCount % 2 === 0) {
            // 点灯
            if (!simulator.errorBlinkDevices) {
                simulator.errorBlinkDevices = new Set();
            }
            simulator.errorBlinkDevices.add(device.id);
        } else {
            // 消灯
            if (simulator.errorBlinkDevices) {
                simulator.errorBlinkDevices.delete(device.id);
                if (simulator.errorBlinkDevices.size === 0) {
                    simulator.errorBlinkDevices = null;
                }
            }
        }
        
        simulator.scheduleRender();
        blinkCount++;
    }, duration);
}

// 複数デバイスの一括点滅
function blinkMultipleDevices(simulator, devices, options = {}) {
    return Promise.all(devices.map(device => {
        return new Promise(resolve => {
            blinkDevice(simulator, device, options);
            setTimeout(resolve, (options.duration || 200) * (options.count || 3) * 2 + 100);
        });
    }));
}

// アニメーション完了を待つヘルパー関数
function waitForAnimation(duration) {
    return new Promise(resolve => setTimeout(resolve, duration));
}

// エフェクト用のアニメーション
function showConnectionEffect(simulator, connection, options = {}) {
    const {
        color = '#4caf50',
        duration = 500
    } = options;
    
    // 接続線をハイライト
    const originalColor = connection.color || '#666';
    connection.color = color;
    connection.width = 3;
    
    simulator.scheduleRender();
    
    setTimeout(() => {
        connection.color = originalColor;
        connection.width = 1;
        simulator.scheduleRender();
    }, duration);
}

// パケット重複回避のためのオフセット計算
const activePackets = new Map(); // デバイスペア → アクティブパケット数

function calculatePacketOffset(fromDevice, toDevice, packetType) {
    const routeKey = `${fromDevice.id}-${toDevice.id}`;
    
    // 現在のアクティブパケット数を取得
    let activeCount = activePackets.get(routeKey) || 0;
    activePackets.set(routeKey, activeCount + 1);
    
    // パケットタイプに応じたより大きなオフセット
    const typeOffsets = {
        'SYN': { x: 0, y: -25 },
        'ACK': { x: 0, y: 25 },
        'DATA': { x: -30, y: 0 },
        'FIN': { x: 30, y: 0 },
        'PING': { x: 0, y: -30 },
        'PONG': { x: 0, y: 30 }
    };
    
    const baseOffset = typeOffsets[packetType] || { x: 0, y: 0 };
    
    // より大きな段分け間隔（16px間隔）
    const stackOffset = (activeCount % 4) * 16;
    
    // 時間ベースでの追加オフセット（同一時間での重複を避ける）
    const timeOffset = (Date.now() % 100) * 0.5;
    
    // クリーンアップ用タイマー
    setTimeout(() => {
        const currentCount = activePackets.get(routeKey) || 0;
        if (currentCount > 0) {
            activePackets.set(routeKey, currentCount - 1);
        }
        if (currentCount <= 1) {
            activePackets.delete(routeKey);
        }
    }, 2000); // より長いクリーンアップ時間
    
    return {
        x: baseOffset.x + (activeCount % 2) * 20, // 左右にも分散
        y: baseOffset.y + stackOffset + timeOffset,
        activeCount: activeCount // アニメーション遅延用
    };
}

// グローバル関数として公開
window.calculateAnimationDuration = calculateAnimationDuration;
window.animatePacketAlongPath = animatePacketAlongPath;
window.animateTCPSegment = animateTCPSegment;
window.animatePingAlongPath = animatePingAlongPath;

// HTTPリクエスト/レスポンスのアニメーション
async function animateHTTPMessage(simulator, source, destination, messageType, options = {}) {
    const {
        onAnimationComplete = null
    } = options;
    
    // メッセージタイプに応じた設定
    let color = '#2196f3';
    let text = 'HTTP';
    
    switch (messageType) {
        case 'request':
            color = '#4caf50';
            text = '📤 HTTP Request';
            break;
        case 'response':
            color = '#ff9800';
            text = '📥 HTTP Response';
            break;
        default:
            color = '#2196f3';
            text = '📡 HTTP';
    }
    
    console.log('🌐 HTTP アニメーション開始:', text, 'from', source.name || source.id, 'to', destination.name || destination.id);
    
    // 経路を計算してHTTPアニメーション実行
    if (window.simulator && typeof window.simulator.findPath === 'function') {
        const path = window.simulator.findPath(source, destination);
        
        if (path && path.length > 1) {
            console.log('✅ HTTP経路が見つかりました:', path.map(d => d.name || d.id).join(' → '));
            
            // TCPキューシステムが利用可能な場合はそれを使用
            if (typeof window.simulator.queuedAnimatePacketAlongPath === 'function') {
                console.log('🔄 HTTPアニメーション: キューシステムを使用');
                await window.simulator.queuedAnimatePacketAlongPath(path, text, color, {
                    hopDelay: 150,        // HTTPは少し遅く
                    packetDuration: 1000, // パケットアニメーション時間
                    onComplete: onAnimationComplete
                });
                return;
            }
            // キューシステムが使えない場合は直接アニメーション実行
            else if (typeof window.simulator.animatePacketAlongPath === 'function') {
                console.log('📡 HTTPアニメーション: 直接実行');
                await window.simulator.animatePacketAlongPath(path, text, color, {
                    hopDelay: 150,        // HTTPは少し遅く
                    packetDuration: 1000, // パケットアニメーション時間
                    onComplete: onAnimationComplete
                });
                return;
            }
        }
    }
    
    // フォールバック: 直線アニメーション
    console.log('⚠️ HTTP用の直線アニメーションにフォールバック');
    await animateSingleHop(simulator, source, destination, {
        color,
        text,
        className: 'http-message-animation',
        duration: 1500
    });
    
    if (onAnimationComplete) {
        onAnimationComplete();
    }
}

// ウィンドウオブジェクトに公開
window.animateHTTPMessage = animateHTTPMessage;

console.log('Animation Helper module loaded successfully');