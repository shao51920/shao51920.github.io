/*  ==============================
    Supabase 全局配置
    ==============================
    注册完 Supabase 后，将下面两个值替换为你项目的真实值：
    1. 在 Supabase Dashboard → Settings → API 页面找到
    2. SUPABASE_URL = 你的 Project URL
    3. SUPABASE_ANON_KEY = 你的 anon / public key
*/

const SUPABASE_URL = 'https://xcwdgwvtgbqcsslbgtpy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g5USxyN0qcqv9peaZE_irQ_B3QIPV_H';

// 初始化 Supabase 客户端 (使用 CDN 引入的全局变量)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
