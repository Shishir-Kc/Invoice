import os 
from dotenv import load_dotenv
from sqlmodel import create_engine,Session
from typing import Annotated
from fastapi import Depends
load_dotenv()
DATABASE_URL=os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL) #type:ignore

def get_session():
    with Session(engine) as session:
        yield session

session_dep = Annotated[Session,Depends(get_session)]
