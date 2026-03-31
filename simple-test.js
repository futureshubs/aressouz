// Browser console da ishga tushirish uchun

// 1. API test
console.log('🔍 Testing rental API...');

// 2. Branch ID ni topish
fetch('https://wnondmqmuvjugbomyolz.supabase.co/functions/v1/make-server-27d0d16c/public/branches', {
    headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indub25kbXFtdXZqdWdib215b3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQxMDYxMTEsImV4cCI6MjAzOTY4MjExMX0.q_J3w2L6XnS6RgZlqUPu1nJz9P6x2g9lFqWkG8Z0D4o',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indub25kbXFtdXZqdWdib215b3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQxMDYxMTEsImV4cCI6MjAzOTY4MjExMX0.q_J3w2L6XnS6RgZlqUPu1nJz9P6x2g9lFqWkG8Z0D4o'
    }
})
.then(r => r.json())
.then(data => {
    console.log('📊 Branches response:', data);
    
    if (data.success && data.data && data.data.length > 0) {
        const branchId = data.data[0].id;
        console.log('✅ Found branch ID:', branchId);
        
        // 3. Branch rental orders test
        return fetch(`https://wnondmqmuvjugbomyolz.supabase.co/functions/v1/make-server-27d0d16c/rentals/orders/${branchId}`, {
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indub25kbXFtdXZqdWdib215b3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQxMDYxMTEsImV4cCI6MjAzOTY4MjExMX0.q_J3w2L6XnS6RgZlqUPu1nJz9P6x2g9lFqWkG8Z0D4o',
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indub25kbXFtdXZqdWdib215b3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQxMDYxMTEsImV4cCI6MjAzOTY4MjExMX0.q_J3w2L6XnS6RgZlqUPu1nJz9P6x2g9lFqWkG8Z0D4o'
            }
        });
    } else {
        throw new Error('No branches found');
    }
})
.then(r => r.json())
.then(ordersData => {
    console.log('📊 Branch rental orders:', ordersData);
    
    // 4. Profile rental orders test
    return fetch('https://wnondmqmuvjugbomyolz.supabase.co/functions/v1/make-server-27d0d16c/rentals/my-rentals?phone=+998901234567', {
        headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indub25kbXFtdXZqdWdib215b3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQxMDYxMTEsImV4cCI6MjAzOTY4MjExMX0.q_J3w2L6XnS6RgZlqUPu1nJz9P6x2g9lFqWkG8Z0D4o',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indub25kbXFtdXZqdWdib215b3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQxMDYxMTEsImV4cCI6MjAzOTY4MjExMX0.q_J3w2L6XnS6RgZlqUPu1nJz9P6x2g9lFqWkG8Z0D4o'
        }
    });
})
.then(r => r.json())
.then(profileData => {
    console.log('📊 Profile rental orders:', profileData);
    console.log('✅ All tests completed!');
})
.catch(error => {
    console.error('❌ Error:', error);
});

console.log('📝 Test started - check console for results...');
