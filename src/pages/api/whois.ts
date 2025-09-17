import type { APIRoute } from 'astro';

// モックデータ関数
function generateMockWhoisData(domain: string) {
    const isIP = /^\d+\.\d+\.\d+\.\d+$/.test(domain);
    
    if (isIP) {
        return {
            domain_name: domain,
            type: 'IP Address',
            registrar: 'Regional Internet Registry',
            creation_date: '1999-01-01T00:00:00Z',
            expiry_date: null,
            updated_date: '2023-12-01T00:00:00Z',
            status: ['allocated'],
            name_servers: [],
            registrant: {
                name: 'REDACTED FOR PRIVACY',
                organization: 'Internet Service Provider',
                country: 'US'
            }
        };
    }
    
    const domains: { [key: string]: any } = {
        'google.com': {
            domain_name: 'google.com',
            registrar: 'MarkMonitor Inc.',
            creation_date: '1997-09-15T04:00:00Z',
            expiry_date: '2028-09-14T04:00:00Z',
            updated_date: '2019-09-09T15:39:04Z',
            status: ['clientDeleteProhibited', 'clientTransferProhibited', 'clientUpdateProhibited'],
            name_servers: ['ns1.google.com', 'ns2.google.com', 'ns3.google.com', 'ns4.google.com'],
            registrant: {
                name: 'REDACTED FOR PRIVACY',
                organization: 'Google LLC',
                country: 'US'
            }
        },
        'github.com': {
            domain_name: 'github.com',
            registrar: 'MarkMonitor Inc.',
            creation_date: '2007-10-09T18:20:50Z',
            expiry_date: '2025-10-09T18:20:50Z',
            updated_date: '2024-09-09T09:18:27Z',
            status: ['clientDeleteProhibited', 'clientTransferProhibited'],
            name_servers: ['dns1.p08.nsone.net', 'dns2.p08.nsone.net'],
            registrant: {
                name: 'REDACTED FOR PRIVACY',
                organization: 'GitHub, Inc.',
                country: 'US'
            }
        },
        'yahoo.co.jp': {
            domain_name: 'yahoo.co.jp',
            registrar: 'Japan Registry Services Co., Ltd.',
            creation_date: '2001-01-18T00:00:00Z',
            expiry_date: '2025-01-31T00:00:00Z',
            updated_date: '2024-01-01T00:00:00Z',
            status: ['clientTransferProhibited'],
            name_servers: ['ns01.yahoo.co.jp', 'ns02.yahoo.co.jp'],
            registrant: {
                name: 'REDACTED FOR PRIVACY',
                organization: 'Yahoo Japan Corporation',
                country: 'JP'
            }
        }
    };
    
    return domains[domain.toLowerCase()] || {
        domain_name: domain,
        registrar: 'Example Registrar Inc.',
        creation_date: '2020-01-01T00:00:00Z',
        expiry_date: '2025-01-01T00:00:00Z',
        updated_date: '2024-01-01T00:00:00Z',
        status: ['clientTransferProhibited'],
        name_servers: ['ns1.example.com', 'ns2.example.com'],
        registrant: {
            name: 'REDACTED FOR PRIVACY',
            organization: 'Private Organization',
            country: 'Unknown'
        }
    };
}

export const POST: APIRoute = async ({ request }) => {
    console.log('Whois API called');
    
    try {
        const body = await request.json();
        const domain = body.domain;
        
        console.log('Domain requested:', domain);
        
        if (!domain) {
            return new Response(JSON.stringify({ 
                error: 'ドメイン名が必要です' 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        try {
            // 実際のIP2Whois APIを呼び出し
            const apiUrl = `https://api.ip2whois.com/v2?key=B13BA312845E9E543F093EA7F25A668F&domain=${encodeURIComponent(domain)}&format=json`;
            console.log('Calling IP2Whois API for:', domain);
            
            const response = await fetch(apiUrl, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (compatible; WhoisLookup/1.0)'
                },
                signal: AbortSignal.timeout(10000) // 10秒タイムアウト
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('IP2Whois API response received for:', domain);
            
            // エラーメッセージが含まれている場合
            if (data.error_message) {
                console.log('API returned error:', data.error_message);
                throw new Error(data.error_message);
            }
            
            return new Response(JSON.stringify(data), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
            
        } catch (apiError) {
            console.log('IP2Whois API failed, falling back to mock data:', apiError);
            
            // APIが失敗した場合はモックデータを返す
            const mockData = generateMockWhoisData(domain);
            
            return new Response(JSON.stringify({
                ...mockData,
                _fallback: true,
                _note: 'APIが利用できないため、デモデータを表示しています'
            }), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    } catch (error) {
        console.error('API Error:', error);
        
        return new Response(JSON.stringify({ 
            error: 'サーバーエラーが発生しました',
            details: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const OPTIONS: APIRoute = async () => {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
};