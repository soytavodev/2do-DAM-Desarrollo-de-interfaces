<?php
/**
 * gravelop-iu · puente entre el navegador y Ollama (modelo local)
 *
 * El navegador no puede llamar directamente a Ollama (otro puerto, otro origen),
 * así que envía la pregunta aquí y PHP la reenvía a http://localhost:11434.
 *
 * Entrada (JSON): { "mensaje": "...", "contexto": "datos de la pantalla", "historial": [{role, content}] }
 * Salida  (JSON): { "respuesta": "texto en Markdown", "modelo": "qwen2.5:1.5b" }
 *
 * Se usa file_get_contents con un contexto HTTP en lugar de curl porque la
 * extensión curl no está instalada en mi PHP y así no hace falta instalar nada.
 */

header("Content-Type: application/json; charset=utf-8");

// Modelo ligero: el equipo no tiene tarjeta gráfica (ollama pull qwen2.5:1.5b)
const MODELO = "qwen2.5:1.5b";
const OLLAMA = "http://localhost:11434/api/chat";

function responder(int $codigo, string $texto): void {
    http_response_code($codigo);
    echo json_encode(["respuesta" => $texto, "modelo" => MODELO], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    responder(405, "Solo se admiten peticiones POST.");
}

// 1. Leer y validar lo que envía el navegador
$entrada = json_decode(file_get_contents("php://input"), true);
$mensaje = trim((string)($entrada["mensaje"] ?? ""));
$contexto = trim((string)($entrada["contexto"] ?? ""));
$historial = is_array($entrada["historial"] ?? null) ? $entrada["historial"] : [];

if ($mensaje === "") {
    responder(400, "El mensaje está vacío.");
}
// Límites para que nadie mande textos enormes a un modelo que corre en mi CPU
$mensaje = mb_substr($mensaje, 0, 2000);
$contexto = mb_substr($contexto, 0, 6000);

// 2. Instrucciones del sistema: quién es el asistente y qué datos puede usar
$sistema = "Eres el asistente del panel interno de Gravelop, un estudio de desarrollo web, apps "
    . "y marketing digital para pymes y autónomos. Responde siempre en español, de forma breve "
    . "y clara, usando Markdown (listas o tablas cuando ayuden). Si te preguntan por los datos, "
    . "usa solo los que aparecen a continuación y no inventes ninguno. Si no están, dilo.\n\n"
    . "DATOS QUE ESTÁ VIENDO EL USUARIO:\n" . ($contexto !== "" ? $contexto : "(ninguno)");

$mensajes = [["role" => "system", "content" => $sistema]];
foreach (array_slice($historial, -6) as $paso) {
    $rol = $paso["role"] ?? "";
    if (($rol === "user" || $rol === "assistant") && isset($paso["content"])) {
        $mensajes[] = ["role" => $rol, "content" => mb_substr((string)$paso["content"], 0, 2000)];
    }
}
$mensajes[] = ["role" => "user", "content" => $mensaje];

// 3. Petición a Ollama
$peticion = stream_context_create([
    "http" => [
        "method" => "POST",
        "header" => "Content-Type: application/json\r\n",
        "content" => json_encode(["model" => MODELO, "messages" => $mensajes, "stream" => false]),
        "timeout" => 180,          // en CPU, una respuesta larga puede tardar
        "ignore_errors" => true    // para poder leer el cuerpo aunque Ollama devuelva un error
    ]
]);

$cuerpo = @file_get_contents(OLLAMA, false, $peticion);

if ($cuerpo === false) {
    responder(502, "No se ha podido conectar con Ollama en localhost:11434. ¿Está en marcha?");
}

// 4. Quedarnos solo con el texto de la respuesta
$datos = json_decode($cuerpo, true);
if (isset($datos["error"])) {
    responder(502, "Ollama ha respondido con un error: " . $datos["error"]);
}

responder(200, $datos["message"]["content"] ?? "No he podido generar una respuesta.");
