from fastapi import HTTPException, Header 


def validate_key(access_key:str=Header(...)):
    if access_key != "hello":
     raise HTTPException(status_code=401,detail="invalid acess_key ")
    return access_key
