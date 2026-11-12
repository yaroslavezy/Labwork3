#include <iostream>
#include <vector>

int sum(const std::vector<int>& v){
    int s = 0;
    for (int x : v){
        s += x;
    }
    return s;
}

void spaces(int a) {
    if (a > 0)   {         
        std::cout << a;
    }
    while (a < 10)	{      
        a++;
    }
}

auto twice = [](int x){ return x * 2; };   

void ok(int a) {
    if (a) {
        std::cout << "){";                
    }
    // if (a){                             
    char c = '{';
    auto raw = R"x(while (a){ })x";         
    int big = 1'000'000;
}

void allman(int a)
{
    if (a)
    {
        ++a;
    }
}

int main() {
    std::vector<int> v = {1, 2, 3};
    std::cout << sum(v) << "\n";
    return 0;
}
