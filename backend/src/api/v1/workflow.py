from fastapi import APIRouter,Depends
from dependency.auth import validate_key

routers = APIRouter()


@routers.get('/auth')
def auth(acess_key=Depends(validate_key)):
    return acess_key

