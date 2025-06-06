<?php
// API key aur destination URL define kar lete hain
$apiKey = 'e70587d6251735344ef79f7b1a50df6ab6bcada5';
$destinationUrl = 'https://pwthor.site/login-success.html';
$alias = 'pw_thor'; // Optional alias

// API URL ko prepare karte hain
$apiUrl = "https://linkcents.com/api?api=$apiKey&url=" . urlencode($destinationUrl) . "&alias=$alias&format=json";

// cURL se API call karte hain
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);

// Response ko JSON format mein parse karte hain
$data = json_decode($response, true);

if ($data['status'] === 'success') {
    // Agar success ho to short URL return karo
    echo json_encode(['shortenedUrl' => $data['shortenedUrl']]);
} else {
    // Error message return karo
    echo json_encode(['error' => 'URL generation failed']);
}
?>
