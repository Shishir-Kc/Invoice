from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import router

server = FastAPI()

server.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@server.get('/')
def root():
    return {
        "status":"yup running"
    }

server.include_router(router,prefix='/api/v1')

