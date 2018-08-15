g++ -o libdiff_adjust.so -std=c++11 -I. -I./comat -I./crypto -fPIC -shared diff_adjust.cpp  params.h uint256.h utilstrencodings.cpp arith_uint256.cpp uint256.cpp
g++ -std=c++11 -I. -I./comat -I./crypto -o tmp tmp.cpp -L. -ldiff_adjust

