# IPTV Synchronization

Aplicación fullstack para sincronizar contenido IPTV hacia una USB externa con estructura compatible con Kodi.

## Stack Tecnológico

- **Backend**: Python 3.11 + FastAPI
- **Frontend**: Angular 17
- **Database**: PostgreSQL 15
- **Contenedores**: Docker Compose

## Requisitos Previos

1. Docker y Docker Compose instalados
2. USB externa montada en `/media/usb`

## Configuración

### 1. Montar USB

```bash
sudo mkdir -p /media/usb
sudo mount /dev/sdb1 /media/usb
```

### 2. Variables de Entorno

Edita el archivo `.env` con tus credenciales IPTV:

```env
IPTV_BASE_URL=http://tu-servidor:8880
IPTV_USER=tu_usuario
IPTV_PASS=tu_password
```

## Iniciar la Aplicación

```bash
# Levantar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f
```

## Acceso

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Estructura de Archivos Kodi

Los archivos se guardan con la siguiente estructura:

```
/media/usb/Compartida_Kodi/
├── Peliculas/
│   └── Titulo_(Año)/
│       ├── Titulo_(Año).mkv
│       ├── Titulo_(Año).nfo
│       └── poster.jpg
└── Series/
    └── Nombre_Serie/
        ├── tvshow.nfo
        ├── poster.jpg
        └── Season 01/
            ├── Nombre_S01E01.mkv
            └── Nombre_S01E01.nfo
```

## Detener la Aplicación

```bash
docker-compose down
```

## Desarrollo

```bash
# Reconstruir imágenes
docker-compose build

# Ver estado de los contenedores
docker-compose ps
```
