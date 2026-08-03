import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

async def run():
    engine = create_async_engine('postgresql+asyncpg://sidedoor:sidedoor@localhost:5432/sidedoor')
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        result = await session.execute(text('SELECT id, email FROM users'))
        print(result.fetchall())
        
asyncio.run(run())
