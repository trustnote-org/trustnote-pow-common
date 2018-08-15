all: blake2b.o libequihash.so test


blake2b.o: ./blake2b/blake2b.cpp
	g++ -D_REENTRANT -std=c++11 -Wall -pedantic -Isrc -fPIC -c -o blake2b/blake2b.o blake2b/blake2b.cpp

libequihash.so: equihash.cpp
	g++ -std=c++11 -fPIC -shared -I. -I./blake2b -o libequihash.so equihash_avx2.o blake2b/blake2b.o equihash.cpp uint256.cpp arith_uint256.cpp
	cp libequihash.so ~/.so

test: test.cpp
	g++ -std=c++11 -I. -I./crypto -L. -lequihash -o test test.cpp equihash_avx2.o

.PHONY: clean
clean:
	-rm test blake2b/blake2b.o libequihash.so
